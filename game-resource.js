'use strict';

(() => {
	
	const that = {
		
		generateObj: (project) => {
			const to2bpp = c => c >> 6;
			
			const palette = project.tileSet.forMasterSystem.palettes[0]
				.map(channels => channels.map(to2bpp))
				.map(([r, g, b]) => r | g << 2 | b << 4);
				
			const processTileLine = line => line.reduce((bitPlanes, pixel, colNum) => {
				/*
				const colMask = 0x80 >> colNum;
				return bitPlanes.map((plane, planeIdx) => {
					const planeMask = 0x01 << planeIdx;
					const finalMask = pixel & planeMask ? colMask : 0;
					return plane | finalMask;
				});
				*/
				const colMask = 0x80 >> colNum;
				return bitPlanes.map(plane => pixel == 14 ? plane : plane | colMask);
			}, [0]);
				
			const tileSet = project.tileSet.forMasterSystem.tiles
				.map(m => m.pixels)
				.map(tile => tile.map(processTileLine));
				
			return {
				palette,
				tileSet: _.flatten(tileSet)
			};
		},
		
		generateBlob: (project) => {
			const obj = that.generateObj(project);
			
			//const arrays = [obj.palette, obj.tileSet].map(a => new Uint8Array(a));
			const arrays = [obj.tileSet].map(a => new Uint8Array(a));
			
			return new Blob(arrays, { type: 'application/octet-stream' });
		},
		
		generateROM: (project) => {
			const resourceToAppend = that.generateBlob(project);
			
			return fetch('base-rom/dist/puzzle_maker_base_rom.sms', {
				method: 'GET',
				headers: {
					'Content-Type': 'application/octet-stream',
				},
				responseType: 'arraybuffer'
			})
			.then(response => response.blob())
			.then(baseROM => {
				return new Blob([baseROM, resourceToAppend], { type: 'application/octet-stream' });
			});
		}
		
	};
	
	window.gameResource = that;
	
})();