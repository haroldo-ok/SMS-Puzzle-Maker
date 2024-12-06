'use strict';

(() => {
	
	window.gameResource = {
		
		generate: (project) => {
			const to2bpp = c => c >> 6;
			
			const palette = project.tileSet.forMasterSystem.palettes[0]
				.map(channels => channels.map(to2bpp))
				.map(([r, g, b]) => r | g << 2 | b << 4);
				
			return {
				palette
			};
		}
		
	};
	
})();