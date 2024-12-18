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

resource_map_format *load_map(int n) {
	char map_file_name[14];
	sprintf(map_file_name, "level%03d.map", n);
	resource_map_format *map = (resource_map_format *) resource_get_pointer(resource_find(map_file_name));
	return map;
}

void draw_map(resource_map_format *map) {
	char *o = map->tiles;
	for (char y = 0; y != map->height; y++) {
		for (char x = 0; x != map->width; x++) {
			draw_tile(x << 1, y << 1, *o);
			o++;
		}
	}
}

char gameplay_loop() {
	return STATE_GAMEOVER;
}

char handle_gameover() {	
	return STATE_START;
}

char handle_title() {
	unsigned int joy = SMS_getKeysStatus();
	int map_number = 1;
	
	while (1) {
		SMS_waitForVBlank();
		SMS_displayOff();
		SMS_disableLineInterrupt();
		
		load_standard_palettes();
		
		SMS_VRAMmemsetW(0, 0, 16 * 1024); 

		SMS_load1bppTiles(font_1bpp, 352, font_1bpp_size, 0, 1);
		SMS_configureTextRenderer(352 - 32);
		
		SMS_mapROMBank(RESOURCE_BANK);
		
		SMS_loadBGPalette(resource_get_pointer(resource_find("main.pal")));
		SMS_loadTiles(resource_get_pointer(resource_find("main.til")), 4, 256 * 32);
		
		resource_map_format *map = load_map(map_number);
		if (!map) {
			map_number = 1;
			load_map(map_number);
		}
		draw_map(map);

		SMS_setNextTileatXY(3, 1);
		puts("Press button to view next map");

		SMS_setNextTileatXY(3, 2);
		puts(map->name);

		SMS_setNextTileatXY(22, 3);
		puts("next ===>");
		

		SMS_displayOn();
		
		// Wait button press
		do {
			SMS_waitForVBlank();
			joy = SMS_getKeysStatus();
		} while (!(joy & (PORT_A_KEY_1 | PORT_A_KEY_2 | PORT_B_KEY_1 | PORT_B_KEY_2)));
		
		map_number++;

		// Wait button release
		do {
			SMS_waitForVBlank();
			joy = SMS_getKeysStatus();
		} while ((joy & (PORT_A_KEY_1 | PORT_A_KEY_2 | PORT_B_KEY_1 | PORT_B_KEY_2)));
	}

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
SMS_EMBED_SDSC_HEADER(0,1, 2024,12,05, "Haroldo-OK\\2024", "SMS-Puzzle-Maker base ROM",
  "Made for SMS-Puzzle-Maker - https://github.com/haroldo-ok/SMS-Puzzle-Maker.\n"
  "Built using devkitSMS & SMSlib - https://github.com/sverx/devkitSMS");
