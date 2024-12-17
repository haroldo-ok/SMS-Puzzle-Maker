PRJNAME := puzzle_maker_base_rom
OBJS := data.rel actor.rel puzzle_maker_base_rom.rel

all: $(PRJNAME).sms

data.c: data/*
	folder2c data data

data/%.psg: data/deflemask/%.vgm
	vgm2psg $< $@ 23

data/%.path: data/path/%.spline.json
	node tool/convert_splines.js $< $@

data/%.bin: data/map/%.tmx
	node tool/convert_map.js $< $@

%.vgm: %.wav
	psgtalk -r 512 -u 1 -m vgm $<

%.rel : %.c
	sdcc -c -mz80 --peep-file lib/peep-rules.txt $<

$(PRJNAME).sms: $(OBJS) SMS-Puzzle-Maker.resource.bin
	sdcc -o $(PRJNAME).ihx -mz80 --no-std-crt0 --data-loc 0xC000 lib/crt0_sms.rel $(OBJS) SMSlib.lib lib/PSGlib.rel
	ihx2sms $(PRJNAME).ihx $(PRJNAME).sms
	
patched: $(PRJNAME).sms
	copy /b $(PRJNAME).sms + SMS-Puzzle-Maker.resource.bin $(PRJNAME)_patched.sms

clean:
	rm *.sms *.sav *.asm *.sym *.rel *.noi *.map *.lst *.lk *.ihx data.*
