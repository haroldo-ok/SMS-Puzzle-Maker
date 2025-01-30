var tinyMapEditor = (function() {
    var win = window,
        doc = document,
		getById = id =>  document.getElementById(id),
        pal = getById('palette').getContext('2d'),
		mapNameInput = getById('mapName'),
		tileEditor = getById('tileEditor'),
        map = tileEditor.getContext('2d'),
		selectedTile = getById('selectedTile'),
		selectedTileIndex = getById('selectedTileIndex'),
        width = 16,
        height = 9,
        tileSize = 16,
        tileZoom = 1,
        srcTile = 0,
        sprite = new Image(),
		tileSetForSms,
		tileSetName,
		mapName,
		mapId,
        tiles,
        tileAttrs,

        player,
        draw,
        build = getById('build'),
        test = getById('test'),
		tileInput = getById('tileInput'),
		
		tileAttrsButton = getById('tileAttrsButton'),
		tileAttrsDialog = getById('tileAttrsDialog'),
		
		loadProjectInput = getById('loadProjectInput'),
		
		widthInput = getById('width'),
        heightInput = getById('height'),
		tileZoomInput = getById('tileZoom'),
		
        addMap = getById('addMap'),
        deleteMap = getById('deleteMap'),
		mapList = getById('mapList'),
		
		generateResource = getById('generateResource'),
		generateROM = getById('generateROM');
		
	const APP_NAME = 'SMS-Puzzle-Maker';
	const STORAGE_PREFIX = APP_NAME + '.';
	const storage = {
		get: k => {
			const json = localStorage[STORAGE_PREFIX + k];
			return json && JSON.parse(json);
		},
		put: (k, v) => localStorage[STORAGE_PREFIX + k] = JSON.stringify(v)
	};

	const DEFAULT_TILE_ATTR = {
		tileIndex: 0,
		isSolid: false,
		isPlayerStart: false,
		isPlayerEnd: false
	};
	
	const DEFAULT_TILE_ATTRS = [
		{
			tileIndex: 1
		},
		{
			tileIndex: 2,
			isPlayerStart: true
		},
		{
			tileIndex: 3,
			isPlayerEnd: true
		},
		{
			tileIndex: 4,
			isSolid: true
		}
	];
	
	const maps = {
		
		loadAll: function() {
			this.data = storage.get('maps') || [];
		},
		
		saveAll: function() {
			storage.put('maps', this.data || []);
		},
		
		replaceAll: function(data) {
			this.data = data;
			this.saveAll();
		},
		
		listAll: function() {
			return this.data;
		},
		
		findById: function(id) {
			return this.data.find(m => m.id === id);
		},
		
		upsert: function(map) {
			const { id, name, ...remaining } = map;
			const mapIds = this.data.map(m => m.id);
			
			let usedId = id;
			
			const prepareMap = (id) => {
				return { 
					id, 
					name: name || ('Unnamed ' + id),
					...remaining
				};
			};
			
			if (id < 1) {
				// Map with no ID: create ID and append
				const maxId = mapIds.length ? Math.max(...mapIds) : 0;
				usedId = maxId + 1;
				this.data.push(prepareMap(usedId));						
			} else if (mapIds.includes(id)) {
				// Map with existing ID: replace it.
				this.data = this.data.map(existingMap => existingMap.id === id ? prepareMap(id) : existingMap);
			} else {
				// Map with non-existing ID: append
				this.data.push(prepareMap(id));
			}
			
			this.saveAll();
			return usedId;
		},
		
		deleteById: function(id) {
			this.data = this.data.filter(m => m.id !== id);
			this.saveAll();
		}
	};

    var app = {
		
		toCharCoord : function(coordInPixels) {
			return coordInPixels / tileSize / tileZoom | 0;
		},
		
        getTile : function(e) {
			var col = this.toCharCoord(e.layerX),
				row = this.toCharCoord(e.layerY);

			return { col, row };
        },
		
		getTilesPerRow : function() {
			return Math.ceil(pal.canvas.width / tileSize);
		},

		getTilesPerCol : function() {
			return Math.ceil(pal.canvas.height / tileSize);
		},
		
		getTileCount : function() {
			return this.getTilesPerRow() * this.getTilesPerCol();
		},

        getSrcTileCoordByIndex : function(tileIndex) {
			if (!tileIndex) return null;

			const tilesPerRow = this.getTilesPerRow();
			const col = (tileIndex -1) % tilesPerRow;
			const row = Math.floor((tileIndex -1) / tilesPerRow);

			return { col, row, tileIndex };
        },

        setTile : function(e) {
			const destTile = this.getTile(e);
			
			this.setTileByCoord(destTile.col, destTile.row, srcTile, map);
			this.setTileIndex(destTile.col, destTile.row, srcTile.tileIndex);
			
			this.saveMap();
        },
		
		setTileByCoord : function(destCol, destRow, srcTile, ctx) {
			ctx.clearRect(destCol * tileSize, destRow * tileSize, tileSize, tileSize);
			ctx.drawImage(sprite, srcTile.col * tileSize, srcTile.row * tileSize, tileSize, tileSize, destCol * tileSize, destRow * tileSize, tileSize, tileSize);
		},
		
		setTileIndex : function(col, row, tileIndex) {
			tiles = tiles || [];
			if (!tiles[row]) tiles[row] = [];
			tiles[row][col] = srcTile.tileIndex;
		},

        drawTool : function() {
            var ctx = selectedTile.getContext('2d'),
                eraser = function() {
                    ctx.fillStyle = 'red';
                    ctx.fillRect(0, 0, tileSize, tileSize);
                    ctx.fillStyle = 'white';
                    ctx.fillRect(2, 2, tileSize - 4, tileSize - 4);
                    ctx.strokeStyle = 'red';
                    ctx.lineWidth = 2;
                    ctx.moveTo(tileSize, 0);
                    ctx.lineTo(0, tileSize);
                    ctx.stroke();
                };
				
			selectedTile.style.zoom = tileZoom;

            selectedTile.width = selectedTile.height = tileSize;

            srcTile ? ctx.drawImage(sprite, srcTile.col * tileSize, srcTile.row * tileSize, tileSize, tileSize, 0, 0, tileSize, tileSize) : eraser();
			selectedTileIndex.innerHTML = srcTile ? srcTile.tileIndex : 'None';
        },
		
		drawMapList: function() {
			mapList.innerHTML = maps.listAll()
				.map(({ name, id, tileIndexes }) => {
					return '<p><label>' +
						`<input type="radio" name="selectedMap" value="${id}" ${id === mapId ? 'checked' : ''} />` + 
						name +
						`<image class="thumbnail loading" data-tme-tile="${JSON.stringify(tileIndexes)}" />` +
					'</label></p>';
				})
				.join('\n');
				
			this.generateThumbnails();
		},
		
		generateThumbnails: function() {
			[...document.querySelectorAll("#mapList .thumbnail")].forEach(thumbnail => {
				window.setTimeout(() => {
					const tileIndexes = JSON.parse(thumbnail.dataset.tmeTile);
					
					const canvas = document.createElement('canvas');
					canvas.width = width * tileSize;
					canvas.height = height * tileSize;
					
					this.prepareMapTiles(tileIndexes);
					this.loadMapIntoContext(tileIndexes, canvas.getContext('2d'));
					
					thumbnail.src = canvas.toDataURL();
				}, 0);
			});
		},
			
		addNewMap: function(e) {
			this.saveCurrentMapToMapList();
			
			mapId = 0;			
			mapNameInput.value = '';
			this.clearMap(e);
			
			this.saveCurrentMapToMapList();
			this.loadMap();
		},
		
		deleteCurrentMap: function(e) {
			if (!confirm(`This will delete the map called\n"${mapName}"\nAre you sure you want to delete it?`)) return;
			
			try {
				if (maps.listAll().length < 2) throw Error("Sorry, this is the last remaining map, and can't be deleted.");
				
				maps.deleteById(mapId);
				this.selectMapById(maps.listAll()[0].id);
				this.drawMapList();				
			} catch (e) {
				const prefix = 'Error while deleting the map';
				console.error(prefix, e);
				alert(prefix + ': ' + e);
			}
		},
		
		selectMap: function(e) {
			const target = e.target || e.srcElement;
			if (target.name !== 'selectedMap') return;
			
			this.saveCurrentMapToMapList();

			const selectedId = parseInt(target.value);
			this.selectMapById(selectedId);
		},
		
		selectMapById: function(selectedId) {			
			const selectedMap = maps.findById(selectedId);
			if (!selectedMap) throw new Error("Couldn't find map with ID = " + target.value);
			
			storage.put('map', selectedMap);
			this.loadMap();
		},

        eraseTile : function(e) {		
			const destTile = this.getTile(e);
			this.eraseTileByCoord(destTile.col, destTile.row);
			this.setTileIndex(destTile.col, destTile.row, 0);
        },		

        eraseTileByCoord : function(col, row, ctx) {		
			ctx.clearRect(col * tileSize, row * tileSize, tileSize, tileSize);
		},
		
        drawMap : function() {
        },

        clearMap : function(e) {
			map.clearRect(0, 0, map.canvas.width, map.canvas.height);
			tiles = null;
			this.destroy();
			build.disabled = false;
        },
		
        loadMap : function() {
			const currentMap = storage.get('map');
			if (!currentMap) return;
			
			tiles = currentMap.tileIndexes;
			this.prepareMapStructure();

			this.loadMapIntoContext(tiles, map);

			mapId = currentMap.id || 0;
			mapName = currentMap.name || '';
			mapNameInput.value = mapName;
			
			this.drawMapList();
		},
		
		loadMapIntoContext(tileIndexes, ctx) {
			for (let row = 0; row < height; row++) {
				for (let col = 0; col < width; col++) {
					const tileIndex = tileIndexes[row][col];
					const localSrcTile = this.getSrcTileCoordByIndex(tileIndex);
					if (localSrcTile) {
						this.setTileByCoord(col, row, localSrcTile, ctx);
					} else {
						this.eraseTileByCoord(col, row, ctx);
					}
				}
			}
		},
		
        saveMap : function() {			
			storage.put('map', this.getMapObject());
        },
		
		getMapObject: function() {
			mapName = mapNameInput.value;

			this.prepareMapStructure();
			
			return {
				id: mapId || 0,
				name: mapName,
				tileIndexes: tiles
			};
		},

        buildMap : function(e) {
			this.outputJSON();
			this.drawMap();
        },

        buildGameResource : function(e) {
			const project = this.generateProjectObject();
			const blob = gameResource.generateBlob(project);

			saveAs(blob, APP_NAME + '.resource.bin');
        },

        buildGameROM : function(e) {
			const project = this.generateProjectObject();
			
			gameResource.generateROM(project)
			.then(blob => saveAs(blob, APP_NAME + '.sms'));
        },

        sortPartial : function(arr) {
            var len = arr.length,
                temp = [],
                i, j;

            for (i = 0; i < tileSize; i++) {
                temp[i] = [];
                for (j = 0; j < len; j++) {
                    if (j % tileSize === j) {
                        temp[i][j] = arr[j * tileSize + i];
                    }
                }
                temp[i] = temp[i].indexOf(255);
            }
            return temp;
        },
		
		prepareMapStructure : function() {
			tiles = tiles || [];
			this.prepareMapTiles(tiles);
		},
		
		prepareMapTiles : function(mapTiles) {
			mapTiles.length = height;
			for (let row = 0; row < height; row++) {
				const tilesRow = mapTiles[row] || [];
				tilesRow.length = width;
				for (let col = 0; col < width; col++) {
					tilesRow[col] = tilesRow[col] || 0;
				}
				mapTiles[row] = tilesRow;
			}
		},
		
		convertToOptimizedTileMap : function(img, options) {
			const quant = new RgbQuantSMS(options);
			return quant.convert(img);
		},

		convertToUnoptimizedTileMap : function(img, options) {
			const quant = new RgbQuantSMS(options);
			quant.sample(img);
			quant.palettes();
			return quant.reduceToTileMap(img);
		},

		saveCurrentMapToMapList : function() {
			this.prepareMapStructure();
			mapId = maps.upsert(this.getMapObject());
			this.saveMap();
			this.drawMapList();
		},
		
		prepareTileAttrsStructure : function() {
			if (!tileAttrs) {
				tileAttrs = [];
			}
			
			tileAttrs.length = this.getTileCount();
			
			DEFAULT_TILE_ATTRS.forEach((defaultAttr, index) => {
				const tileAttr = tileAttrs[index];
				if (!tileAttr) tileAttrs[index] = { ...defaultAttr };
			});
			
			tileAttrs = _.map(tileAttrs, tileAttr => {
				if (!tileAttr) {
					return null;
				}
				
				const cleanedUpAttr = { ...DEFAULT_TILE_ATTR };				
				Object.keys(tileAttr).forEach(k => cleanedUpAttr[k] = tileAttr[k]);
				
				return cleanedUpAttr;
			});
			
			_.each(tileAttrs, (tileAttr, index) =>  {
				const cleanedUpAttr = tileAttr || { ...tileAttrs[index - 1] };
				cleanedUpAttr.tileIndex = index + 1;
				tileAttrs[index] = cleanedUpAttr;
			});

			console.log('tileAttrs', tileAttrs);
		},
		
		showTileAttrsPopup : function() {
			this.prepareTileAttrsStructure();
			
			const h = elFactory;
			
			const createTd = (...children) => h('td', {}, ...children);
			const createDiv = (...children) => h('div', {}, ...children);
			const createCheckbox = attributes => h('input', { type: 'checkbox', ...attributes });
			
			const createDataCheckbox = (object, attrName, attributes) => {
				const checkbox = createCheckbox(attributes || {});
				
				checkbox.checked = object[attrName];
				checkbox.addEventListener('click', e => {
					const target = e.target || e.srcElement;					
					object[attrName] = target.checked;
					console.log('Clicked on checkbox', { checked: target.checked, tileAttrs });					
				});
				
				return checkbox;
			}
			
			const headerRow = ['#', 'Tile', 'Solid?', 'Player Start?', 'Player End?']
				.map(name => h('th', {}, name));				
				
			const dataRows = tileAttrs.map(tileAttr => 
				h('tr', {}, 
					createTd('' + tileAttr.tileIndex),
					createTd('...'),
					createDataCheckbox(tileAttr, 'isSolid')
				)
			);
			
			const table = h('table', {}, 
				h('tr', {}, ...headerRow),
				...dataRows
			);
			
			tileAttrsDialog.innerHTML = '';
			tileAttrsDialog.appendChild(table);
			tileAttrsDialog.showModal();
		},
		
		generateProjectObject : function() {
			this.saveCurrentMapToMapList();
			
			return {
				tool: {
					name: APP_NAME,
					version: '0.16.1',
					format: '0.1.0'
				},
				options: {
					tileZoom,
					tileSize,
					mapWidth: width,
					mapHeight: height
				},
				maps: maps.listAll(),
				tileSet: {
					name: tileSetName,
					src: sprite.src,
					forMasterSystem: tileSetForSms
				}
			};
		},
		
        outputJSON : function() {
			const project = this.generateProjectObject();
            const output = neatJSON(project, { afterColon: 1, afterComma: 1, objectPadding: 1 });
			
			var blob = new Blob([output], { type: 'application/json' });
			saveAs(blob, APP_NAME + '.project.json');
        },
		
		inputJSON: function(json) {
			const project = JSON.parse(json);
			
			if (!project || !project.tool || project.tool.name !== APP_NAME) {
				throw new Error('This does not seem to be a ' + APP_NAME + ' JSON project.');
			}
			
			if (project.tool.format !== '0.1.0') {
				throw new Error('Unknown format: ' + project.tool.format);
			}
			
			this.loadSizeVariablesFromObject(project.options);
			this.updateSizeVariables();
			
			maps.replaceAll(project.maps);
			
			this.selectMapById(project.maps[0].id);
			this.saveMap();
			
			storage.put('tileSet', project.tileSet);

			this.destroy();
			this.init();
		},

		updateSizeVariables : function() {
			const inputToNumber = el => +el.value || 1;
			
			width = 16;
			height = 9;
			tileSize = 16;
			tileZoom = inputToNumber(tileZoomInput);

			storage.put('mapSize', {
				mapWidth: width,
				mapHeight: height,
				tileSize,
				tileZoom
			});
		},

		loadSizeVariables : function() {
			this.loadSizeVariablesFromObject(storage.get('mapSize'));
		},

		loadSizeVariablesFromObject : function(storedSize) {
			if (!storedSize) return;
			
			widthInput.value = storedSize.mapWidth;
			heightInput.value = storedSize.mapHeight;
			tileZoomInput.value = storedSize.tileZoom;
		},

        bindEvents : function() {
            var _this = this;


            /**
             * Tileset events
             */

            pal.canvas.addEventListener('click', function(e) {
				srcTile = _this.getTile(e);                
				if (srcTile) {
					srcTile.tileIndex = srcTile.col + srcTile.row * pal.canvas.width / tileSize + 1;
				}
				
                _this.drawTool();
            }, false);
			
			tileAttrsButton.addEventListener('click', () => _this.showTileAttrsPopup());
			
			/**
			 * Map list events.
			 */

			mapList.addEventListener('change', e => _this.selectMap(e));
			addMap.addEventListener('click', e => _this.addNewMap(e));
			deleteMap.addEventListener('click', e => _this.deleteCurrentMap(e));
			
			/***
			 * Tile editor events
			 */
			 
			const handleTileEditorMouseEvent = e => {
				if (e.buttons != 1) return;
				if (srcTile) {
					_this.setTile(e);
				} else {
					_this.eraseTile(e);
				}
			};
			tileEditor.addEventListener('mousedown', handleTileEditorMouseEvent);
			tileEditor.addEventListener('mousemove', handleTileEditorMouseEvent);
			
			mapNameInput.addEventListener('change', () => _this.saveMap());
			
            /**
             * Image load event
             */

            sprite.addEventListener('load', function() {
                pal.canvas.width = this.width;
                pal.canvas.height = this.height;
				pal.canvas.style.zoom = tileZoom;
                pal.drawImage(this, 0, 0);
				tileSetForSms = _this.convertToUnoptimizedTileMap(pal.canvas, { colors: 16 });
				
				storage.put('tileSet', {					
					name: tileSetName,
					src: sprite.src,
					forMasterSystem: tileSetForSms
				});

				_this.loadMap();
            }, false);


            /**
             * Input change events
             */
			 
			[widthInput, heightInput, tileZoomInput].forEach(input => {
				input.addEventListener('change', function() {
					_this.updateSizeVariables();
					_this.destroy();
					_this.init();
				}, false);				
			});

			/**
			 * Tileset file event
			 */
			tileInput.addEventListener('change', () => {
				if (!tileInput.files.length) return;
				
				const file = tileInput.files[0];
						 
				const fr = new FileReader();
				fr.onload = function () {
					tileSetName = file.name;
					sprite.src = fr.result;					
				}
				fr.readAsDataURL(file);
			 });
			 
			/**
			 * Project file event			
			 */
			loadProjectInput.addEventListener('change', () => {
				if (!loadProjectInput.files.length) return;
				
				const file = loadProjectInput.files[0];
						 
				const fr = new FileReader();
				fr.onload = function () {
					try {
						_this.inputJSON(fr.result);
					} catch (e) {
						const prefix = 'Error loading project';
						console.error(prefix, e);
						alert(prefix + ': ' + e);
					}
				}
				fr.readAsText(file);
			 });
			 
			/**
			 * Game resource event
			 */
			generateResource.addEventListener('click', e => _this.buildGameResource(e));
			generateROM.addEventListener('click', e => _this.buildGameROM(e));

			/**
			 * Map buttons
			 */
			getById('erase').addEventListener('click', e => {
				srcTile = 0;
				_this.drawTool();
			});
			getById('build').addEventListener('click', e => _this.buildMap(e));
			getById('clear').addEventListener('click', e => _this.clearMap(e));
        },

        init : function() {
			this.loadSizeVariables();
			this.updateSizeVariables();
			
			const storedTileSet = storage.get('tileSet');
			tileSetName = storedTileSet && storedTileSet.name || 'Unnamed';
			tileSetForSms = storedTileSet && storedTileSet.forMasterSystem;
			
			let storedSrc = storedTileSet && storedTileSet.src || 'assets/default_tilemap.png';
			if (storedSrc.startsWith('http:') || storedSrc.startsWith('https:')) {
				storedSrc = 'assets/default_tilemap.png';
			}
			sprite.src = storedSrc;
			
            map.canvas.width = width * tileSize;
            map.canvas.height = height * tileSize;
			map.canvas.style.zoom = tileZoom;
			
            this.drawTool();
			this.drawMapList();
        },

        destroy : function() {
            clearInterval(draw);
        }
    };

	try {
		maps.loadAll();
	} catch (e) {
		console.error('Error loading maps', e);
	}

    app.bindEvents();
    app.init();
	
	window.app = app;
	window.maps = maps;
		
    return app;

})();
