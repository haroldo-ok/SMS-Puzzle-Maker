'use strict';

(() => {
	
	function padArrayEnd(arr, len, padding){
	   return arr.concat(Array(len - arr.length).fill(padding));
	}
	
	const stringToByteArray = s => [...s.split('').map(ch => ch.charCodeAt(0)), 0];
	const stringToPaddedByteArray = (s, len) => padArrayEnd(s.split('').map(ch => ch.charCodeAt(0)), len, 0);
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
			
			const maps = project.maps.map(({ id, name, tileIndexes }, idx) => ({
				fileName: `level${(idx + 1).toString().padStart(3, '0')}.map`,
				content: [
					...toBytePair(id),
					...toBytePair(project.options.mapWidth),
					...toBytePair(project.options.mapHeight),
					...stringToPaddedByteArray(name, 32, 0),
					..._.flatten(tileIndexes)
				]
			}));
			
			const tileAttributes = project.tileSet.attributes
				.map(attr => {
					return ['isSolid', 'isPlayerStart', 'isPlayerEnd', 'isPushable']
						.reduce((acc, key, idx) => acc | ((attr[key] ? 1 : 0) << idx), 0);
				});
				
			const projectInfo = [project.tool.name, project.tool.version, project.projectInfo.name].map(stringToByteArray);
				
			return {
				palette,
				tileSet: _.flatten(tileSet),
				tileAttributes: _.flatten(tileAttributes.map(toBytePair)),
				projectInfo: _.flatten(projectInfo),
				maps
			};
		},
		
		generateInternalFiles: (project) => {
			const obj = that.generateObj(project);

			console.log(obj.maps);
			const maps = Object.fromEntries(obj.maps.map(m => [m.fileName, m.content]));
			console.log(maps);

			return {
				'main.pal': padArrayEnd(obj.palette, 16, 0),
				'main.til': obj.tileSet,
				'main.atr': obj.tileAttributes,
				'project.inf': obj.projectInfo,
				...maps
			};			
		},
		
		generateInternalFileSystem: (project) => {
			const internalFiles = that.generateInternalFiles(project);
			const fileEntries = Object.keys(internalFiles).sort()
				.map(fileName => ({ fileName, content: internalFiles[fileName] }));
				
			const fileEntryFormat = {
				name: 14,
				page: 2,
				size: 2,
				offset: 2
			};
			
			const fileEntrySize = Object.values(fileEntryFormat).reduce((acc, n) => acc + n, 0);
			const fileEntriesSize = fileEntries.length * fileEntrySize;
			
			const header = [
				...stringToPaddedByteArray('rsc', 4),
				...toBytePair(fileEntries.length)
			];

			const fileContentInitialOffset = header.length + fileEntriesSize;
			
			const PAGE_SIZE = 16 * 1024;
			const INITIAL_PAGE = 2;
			
			// For now, uses a simplistic page allocation
			let nextPageNumber = INITIAL_PAGE;
			let fileContentOffset = fileContentInitialOffset;
			const allocatedFileEntries = fileEntries
				.map(({ fileName, content }) => {
					if (fileContentOffset + content.length > PAGE_SIZE) {
						nextPageNumber++;
						fileContentOffset = 0;
					}
					
					const entry = {
						fileName,
						pageNumber: nextPageNumber,
						offset: fileContentOffset,
						contentLength: content.length,
						content
					};

					fileContentOffset += content.length;
					
					return entry;
				});
			console.log('allocatedFileEntries', allocatedFileEntries);

			const fileEntriesTable = allocatedFileEntries
				.map(({ fileName, pageNumber, offset, content }) => {
					const entry = [
						...stringToPaddedByteArray(fileName, fileEntryFormat.name),
						...toBytePair(pageNumber),
						...toBytePair(content.length),
						...toBytePair(offset)
					];
					
					return entry;
				});
				
			const pages = [
				[...header, ..._.flatten(fileEntriesTable)]
			];
			allocatedFileEntries.forEach(({ fileName, pageNumber, offset, content }) => {
				const pageIndex = pageNumber - INITIAL_PAGE;
				const pageData = pages[pageIndex] || [];
				
				if (pageData.length < PAGE_SIZE) {
					pageData.length = PAGE_SIZE;
					for (let idx = 0; idx < PAGE_SIZE; idx++) {
						pageData[idx] = pageData[idx] || 0;
					}
				}
				
				content.forEach((byte, idx) => {
					pageData[offset + idx] = byte;
				});
				
				pages[pageIndex] = pageData;
			});
			
			console.log('pages', pages);

			return _.flatten(pages);
		},
		
		generateBlob: (project) => {
			const obj = that.generateObj(project);
			
			const arrays = [
				that.generateInternalFileSystem(project)
			].map(a => new Uint8Array(a));
			
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