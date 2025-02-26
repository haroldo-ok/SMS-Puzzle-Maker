#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include "lib/SMSlib.h"
#include "lib/PSGlib.h"
#include "data.h"
#include "actor.h"

#define SCREEN_W (256)
#define SCREEN_H (192)
#define SCROLL_H (224)

#define STATE_START (1)
#define STATE_GAMEPLAY (2)
#define STATE_GAMEOVER (3)

#define RESOURCE_BANK (2)
#define RESOURCE_BASE_ADDR (0x8000)

#define MAP_SCREEN_Y (6)

#define TILE_ATTR_SOLID (0x0001)
#define TILE_ATTR_PLAYER_START (0x0002)
#define TILE_ATTR_PLAYER_END (0x0004)
#define TILE_ATTR_PUSHABLE (0x0008)

actor player;

typedef struct resource_header_format {
	char signature[4];
	unsigned int file_count;
} resource_header_format;

typedef struct resource_entry_format {
	char name[14];
	unsigned int page;
	unsigned int size;
	unsigned int offset;
} resource_entry_format;

typedef struct resource_map_format {
	unsigned int id;
	unsigned int width;
	unsigned int height;
	char name[32];
	char tiles[];
} resource_map_format;

const resource_header_format *resource_header = RESOURCE_BASE_ADDR;
const resource_entry_format *resource_entries = RESOURCE_BASE_ADDR + sizeof(resource_header_format);

resource_entry_format *tile_attrs;
char stage_clear;

char map_data[9*16], map_floor[9*16];
char is_map_data_dirty;

resource_entry_format *resource_find(char *name) {
	SMS_mapROMBank(RESOURCE_BANK);

	// TODO: Implement binary search; the names are already sorted.
	// Searches sequentially, for now.
	unsigned int remaining_entries = resource_header->file_count;
	resource_entry_format *entry = resource_entries;
	while (remaining_entries) {
		if (!strcmp(name, entry->name)) {
			return entry;
		}
		
		entry++;
		remaining_entries--;
	}
	
	return 0;
}

char *resource_get_pointer(resource_entry_format *entry) {
	SMS_mapROMBank(RESOURCE_BANK);
	
	if (!entry) return 0;
	
	unsigned int page = entry->page;
	char *p = RESOURCE_BASE_ADDR + entry->offset;
	
	SMS_mapROMBank(page);
	return p;
}

void load_standard_palettes() {
	SMS_setBGPaletteColor(0, 0);
	SMS_setBGPaletteColor(1, 0x3F);
}

void draw_tile(char x, char y, unsigned int tileNumber) {
	static unsigned int sms_tile;
	
	y += MAP_SCREEN_Y;
	
	sms_tile = tileNumber << 2;
	
	SMS_setNextTileatXY(x, y);	
	SMS_setTile(sms_tile);
	SMS_setTile(sms_tile + 2);

	SMS_setNextTileatXY(x, y + 1);
	SMS_setTile(sms_tile + 1);
	SMS_setTile(sms_tile + 3);
}

inline char *get_map_tile_pointer(resource_map_format *map, char *data, char x, char y) {
	return data + (y * map->width) + x;
}

char get_map_tile(resource_map_format *map, char x, char y) {
	return *(get_map_tile_pointer(map, map_data, x, y));
}

void set_map_tile(resource_map_format *map, char x, char y, char new_value) {
	*(get_map_tile_pointer(map, map_data, x, y)) = new_value;
}

char get_floor_tile(resource_map_format *map, char x, char y) {
	return *(get_map_tile_pointer(map, map_floor, x, y));
}

void set_floor_tile(resource_map_format *map, char x, char y, char new_value) {
	*(get_map_tile_pointer(map, map_floor, x, y)) = new_value;
}

unsigned int get_tile_attr(char tile_number) {
	if (!tile_number) tile_number = 1;
	unsigned int *tile_attr_p = resource_get_pointer(tile_attrs);
	return tile_attr_p[tile_number - 1];	
}

resource_map_format *load_map(int n) {
	char map_file_name[14];
	sprintf(map_file_name, "level%03d.map", n);
	resource_map_format *map = (resource_map_format *) resource_get_pointer(resource_find(map_file_name));
	return map;
}

void prepare_map_data(resource_map_format *map) {
	memcpy(map_data, map->tiles, map->height * map->width);
	memcpy(map_floor, 0, map->height * map->width);
}

void draw_map(resource_map_format *map) {
	char *o = map_data;
	for (char y = 0; y != map->height; y++) {
		for (char x = 0; x != map->width; x++) {
			draw_tile(x << 1, y << 1, *o);
			o++;
		}
	}
}

char get_actor_map_x(actor *act) {
	return act->x >> 4;
}

char get_actor_map_y(actor *act) {
	return (act->y - (MAP_SCREEN_Y << 3)) >> 4;
}

void set_actor_map_xy(actor *act, char x, char y) {
	act->x = x << 4;
	act->y = (y << 4) + (MAP_SCREEN_Y << 3);
}

char try_pushing_tile_on_map(resource_map_format *map, char x, char y, signed char delta_x, signed char delta_y) {
	char new_x = x + delta_x;
	char new_y = y + delta_y;
	if (new_x >= map->width || new_y >= map->height) return 0;

	char target_tile = get_map_tile(map, new_x, new_y);
	unsigned int target_tile_attr = get_tile_attr(target_tile);	
	
	if (target_tile_attr & TILE_ATTR_SOLID) return 0;

	char source_tile = get_map_tile(map, x, y);	
	char source_floor_tile = get_floor_tile(map, x, y);
	
	set_map_tile(map, x, y, source_floor_tile ? source_floor_tile : 1);
	set_map_tile(map, new_x, new_y, source_tile);
	
	set_floor_tile(map, new_x, new_y, target_tile);

	is_map_data_dirty = 1;
	
	return 1;
}

void try_moving_actor_on_map(actor *act, resource_map_format *map, signed char delta_x, signed char delta_y) {
	char x = get_actor_map_x(act);
	char y = get_actor_map_y(act);
	
	char new_x = x + delta_x;
	char new_y = y + delta_y;
	if (new_x >= map->width || new_y >= map->height) return;
	
	char tile = get_map_tile(map, new_x, new_y);
	unsigned int tile_attr = get_tile_attr(tile);	

	if (tile_attr & TILE_ATTR_PLAYER_END) stage_clear = 1;
	
	if (tile_attr & TILE_ATTR_PUSHABLE) {
		if (!try_pushing_tile_on_map(map, new_x, new_y, delta_x, delta_y)) return;
	} else if (tile_attr & TILE_ATTR_SOLID) {
		return;
	}
	
	set_actor_map_xy(act, new_x, new_y);
}

void player_find_start(resource_map_format *map) {
	char *o = map->tiles;
	for (char y = 0; y != map->height; y++) {
		for (char x = 0; x != map->width; x++) {
			unsigned int tile_attr = get_tile_attr(*o);
			if (tile_attr & TILE_ATTR_PLAYER_START) {
				set_actor_map_xy(&player, x, y);
			}
			o++;
		}
	}
}

char *skip_after_end_of_string(char *s) {
	while (*s) s++;
	return s + 1;
}

void initialize_graphics() {
	SMS_waitForVBlank();
	SMS_displayOff();
	SMS_disableLineInterrupt();
	
	load_standard_palettes();
	
	SMS_VRAMmemsetW(0, 0, 16 * 1024); 

	SMS_load1bppTiles(font_1bpp, 352, font_1bpp_size, 0, 1);
	SMS_configureTextRenderer(352 - 32);
	
	SMS_mapROMBank(RESOURCE_BANK);
	
	SMS_loadBGPalette(resource_get_pointer(resource_find("main.pal")));
	SMS_loadSpritePalette(resource_get_pointer(resource_find("main.pal")));
}

void wait_button_press() {
	unsigned int joy;
	
	// Wait button press
	do {
		SMS_waitForVBlank();
		joy = SMS_getKeysStatus();
	} while (!(joy & (PORT_A_KEY_1 | PORT_A_KEY_2 | PORT_B_KEY_1 | PORT_B_KEY_2)));
}

void wait_button_release() {
	unsigned int joy;
	
	// Wait button release
	do {
		SMS_waitForVBlank();
		joy = SMS_getKeysStatus();
	} while ((joy & (PORT_A_KEY_1 | PORT_A_KEY_2 | PORT_B_KEY_1 | PORT_B_KEY_2)));
}

char gameplay_loop() {
	unsigned int joy = SMS_getKeysStatus();
	unsigned int joy_prev = 0;
	unsigned int joy_delay = 0;
	
	int map_number = 1;	
	
	while (1) {
		initialize_graphics();

		SMS_loadTiles(resource_get_pointer(resource_find("main.til")), 4, 256 * 32);
		
		tile_attrs = resource_find("main.atr");
		
		resource_map_format *map = load_map(map_number);
		if (!map) {
			map_number = 1;
			map = load_map(map_number);
		}
		prepare_map_data(map);
		draw_map(map);

		SMS_setNextTileatXY(2, 1);
		puts("Press button to skip map");

		SMS_setNextTileatXY(2, 2);
		puts(map->name);

		SMS_setNextTileatXY(22, 3);
		puts("next ===>");
		

		SMS_displayOn();
		
		init_actor(&player, 32, 32, 2, 1, 8, 2);
		player_find_start(map);

		stage_clear = 0;
		is_map_data_dirty = 0;
		
		do {
			// Wait button press
			if (joy_delay) joy_delay--;
			if (!joy_delay || joy != joy_prev) {
				char ply_map_x = get_actor_map_x(&player);
				char ply_map_y = get_actor_map_y(&player);
				
				if (joy & PORT_A_KEY_UP) {
					try_moving_actor_on_map(&player, map, 0, -1);
				} else if (joy & PORT_A_KEY_DOWN) {
					try_moving_actor_on_map(&player, map, 0, 1);
				} else if (joy & PORT_A_KEY_LEFT) {
					try_moving_actor_on_map(&player, map, -1, 0);
				} else if (joy & PORT_A_KEY_RIGHT) {
					try_moving_actor_on_map(&player, map, 1, 0);
				}
				
				joy_delay = 10;
			}
			
			SMS_initSprites();
			draw_actor(&player);
			SMS_finalizeSprites();	
			
			SMS_waitForVBlank();
			SMS_copySpritestoSAT();	
			
			if (is_map_data_dirty) draw_map(map);
			
			joy_prev = joy;
			joy = SMS_getKeysStatus();
		} while (!stage_clear && !(joy & (PORT_A_KEY_1 | PORT_A_KEY_2 | PORT_B_KEY_1 | PORT_B_KEY_2)));
		
		map_number++;

		wait_button_release();
	}

	return STATE_GAMEOVER;
}

char handle_gameover() {
	return STATE_START;
}

char handle_title() {
	initialize_graphics();
	
	char *app_name = resource_get_pointer(resource_find("project.inf"));
	char *app_version = skip_after_end_of_string(app_name);
	char *project_name = skip_after_end_of_string(app_version);
	
	SMS_setNextTileatXY(2, 1);
	printf("%s %s", app_name, app_version);

	SMS_setNextTileatXY(2, 3);
	puts(project_name);

	SMS_setNextTileatXY(2, 21);
	puts("Press any button to start");

	SMS_displayOn();
	
	wait_button_press();
	wait_button_release();
	
	return STATE_GAMEPLAY;
}

void main() {
	char state = STATE_START;
	
	SMS_useFirstHalfTilesforSprites(1);
	SMS_setSpriteMode(SPRITEMODE_TALL);
	
	while (1) {
		switch (state) {
			
		case STATE_START:
			state = handle_title();
			break;
			
		case STATE_GAMEPLAY:
			state = gameplay_loop();
			break;
			
		case STATE_GAMEOVER:
			state = handle_gameover();
			break;
		}
	}
}

SMS_EMBED_SEGA_ROM_HEADER(9999,0); // code 9999 hopefully free, here this means 'homebrew'
SMS_EMBED_SDSC_HEADER(0,4, 2025,02,18, "Haroldo-OK\\2025", "SMS-Puzzle-Maker base ROM",
  "Made for SMS-Puzzle-Maker - https://github.com/haroldo-ok/SMS-Puzzle-Maker.\n"
  "Built using devkitSMS & SMSlib - https://github.com/sverx/devkitSMS");
