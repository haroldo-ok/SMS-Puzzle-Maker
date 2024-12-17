'use strict';

(() => {
	
	function padArrayEnd(arr, len, padding){
	   return arr.concat(Array(len - arr.length).fill(padding));
	}
	
	const toBytePair = n => [n & 0xFF, (n >> 8) & 0xFF];

	const that = {
		
		generateObj: (project) => {
			const to2bpp = c => c >> 6;
			
			const smsTileSet = project.tileSet.forMasterSystem;
			
			const palette = smsTileSet.palettes[0]
				.map(channels => channels.map(to2bpp))
				.map(([r, g, b]) => r | g << 2 | b << 4);
				
			const processTileLine = line => line.reduce((bitPlanes, pixel, colNum) => {
				const colMask = 0x80 >> colNum;
				return bitPlanes.map((plane, planeIdx) => {
					const planeMask = 0x01 << planeIdx;
					const finalMask = pixel & planeMask ? colMask : 0;
					return plane | finalMask;
				});
			}, [0, 0, 0, 0]);
				
			const processTile = tile => tile.map(processTileLine);
			const processTileAt = (col, row) => {
				if (col >= smsTileSet.mapW || row >= smsTileSet.mapH) {
					return 0;
				}
				
				const tileIndex = (row * smsTileSet.mapW + col) || 0;
				return processTile(smsTileSet.tiles[tileIndex].pixels);
			};
			
			const tileSetW = Math.ceil(smsTileSet.mapW / 2);
			const tileSetH = Math.ceil(smsTileSet.mapH / 2);
			
			const tileSet = [];
			for (let tileSetRow = 0; tileSetRow < tileSetH; tileSetRow++) {
				for (let tileSetCol = 0; tileSetCol < tileSetW; tileSetCol++) {
					const tileRow = tileSetRow * 2;
					const tileCol = tileSetCol * 2;
					
					tileSet.push(processTileAt(tileCol, tileRow));
					tileSet.push(processTileAt(tileCol, tileRow + 1));
					tileSet.push(processTileAt(tileCol + 1, tileRow));
					tileSet.push(processTileAt(tileCol + 1, tileRow + 1));
				}
			}
			
			const maps = _.flatten(project.maps[0].tileIndexes);
				
			return {
				palette,
				tileSet: _.flatten(tileSet),
				maps
			};
		},
		
		generateInternalFiles: (project) => {
			const obj = that.generateObj(project);

			return {
				'main.pal': padArrayEnd(obj.palette, 16, 0)
			};			
		},

		generateInternalFileSystem: (project) => {
			const internalFiles = that.generateInternalFiles(project);
			return Object.keys(internalFiles).sort()
				.map(fileName => ({ fileName, content: internalFiles[fileName] }));
		},
		
		generateBlob: (project) => {
			const obj = that.generateObj(project);
			
			const arrays = [
				padArrayEnd(obj.palette, 16, 0), 
				toBytePair(obj.tileSet.length),
				obj.tileSet,
				toBytePair(obj.maps.length),
				obj.maps
			].map(a => new Uint8Array(a));
			
			console.log(that.generateInternalFileSystem(project));
			
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