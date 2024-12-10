'use strict';

(() => {
	
	const that = {
		
		generateObj: (project) => {
			const to2bpp = c => c >> 6;
			
			const palette = project.tileSet.forMasterSystem.palettes[0]
				.map(channels => channels.map(to2bpp))
				.map(([r, g, b]) => r | g << 2 | b << 4);
				
			return {
				palette
			};
		},
		
		generateBlob: (project) => {
			const obj = that.generateObj(project);
			
			return new Blob([new Uint8Array(obj.palette)], { type: 'application/octet-stream' });
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
				debugger;
				return new Blob([baseROM, resourceToAppend], { type: 'application/octet-stream' });
			});
		}
		
	};
	
	window.gameResource = that;
	
})();