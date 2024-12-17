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
	
	unsigned int page = entry->page;
	char *p = RESOURCE_BASE_ADDR + entry->offset;
	
	SMS_mapROMBank(page);
	return p;
}

void load_standard_palettes() {
	SMS_setBGPaletteColor(0, 0);
	SMS_setBGPaletteColor(1, 0x3F);
}

char gameplay_loop() {
	return STATE_GAMEOVER;
}

char handle_gameover() {	
	return STATE_START;
}

void draw_tile(char x, char y, unsigned int tileNumber) {
	static unsigned int sms_tile;
	
	sms_tile = tileNumber << 2;
	
	SMS_setNextTileatXY(x, y);	
	SMS_setTile(sms_tile);
	SMS_setTile(sms_tile + 2);

	SMS_setNextTileatXY(x, y + 1);
	SMS_setTile(sms_tile + 1);
	SMS_setTile(sms_tile + 3);
}

char handle_title() {
	unsigned int joy = SMS_getKeysStatus();

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

	char *o = resource_get_pointer(resource_find("level001.map"));
	for (char y = 0; y != 9; y++) {
		for (char x = 0; x != 16; x++) {
			draw_tile(x << 1, y << 1, *o);
			o++;
		}
	}

	SMS_setNextTileatXY(3, 16);
	puts("Press any button to start");

	SMS_displayOn();
	
	// Wait button press
	do {
		SMS_waitForVBlank();
		joy = SMS_getKeysStatus();
	} while (!(joy & (PORT_A_KEY_1 | PORT_A_KEY_2 | PORT_B_KEY_1 | PORT_B_KEY_2)));

	// Wait button release
	do {
		SMS_waitForVBlank();
		joy = SMS_getKeysStatus();
	} while ((joy & (PORT_A_KEY_1 | PORT_A_KEY_2 | PORT_B_KEY_1 | PORT_B_KEY_2)));

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
