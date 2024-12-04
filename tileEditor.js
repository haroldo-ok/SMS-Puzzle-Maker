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
        width = 10,
        height = 10,
        tileSize = 32,
        tileZoom = 1,
        srcTile = 0,
        sprite = new Image(),
		tileSetForSms,
		tileSetName,
		mapName,
		mapId,
        tiles, // used for demo, not *really* needed atm
        alpha,

        player,
        draw,
        build = getById('build'),
        test = getById('test'),
		tileInput = getById('tileInput'),
		loadProjectInput = getById('loadProjectInput'),
		
		widthInput = getById('width'),
        heightInput = getById('height'),
        tileSizeInput = getById('tileSize'),
		tileZoomInput = getById('tileZoom');
		
	const APP_NAME = 'SMS-Puzzle-Maker';
	const STORAGE_PREFIX = APP_NAME + '.';
	const storage = {
		get: k => {
			const json = localStorage[STORAGE_PREFIX + k];
			return json && JSON.parse(json);
		},
		put: (k, v) => localStorage[STORAGE_PREFIX + k] = JSON.stringify(v)
	};
	
	const maps = {
		
		loadAll: function() {
			this.data = storage.get('maps') || [];
		},
		
		saveAll: function() {
			storage.put('maps', this.data || []);
		},
		
		listAll: function() {
			return this.data;
		},
		
		upsert: function(map) {
			const {id, ...remaining} = map;
			const mapIds = this.data.map(m => m.id);
			let usedId = id;
			
			if (id < 1) {
				// Map with no ID: create ID and append
				const maxId = mapIds.length ? Math.max(...mapIds) : 0;
				usedId = maxId + 1;
				this.data.push({
					id: usedId,
					...remaining
				});						
			} else if (mapIds.includes(id)) {
				// Map with existing ID: replace it.
				this.data = this.data.map(existingMap => existingMap.id === id ? map : existingMap);
			} else {
				// Map with non-existing ID: append
				this.data.push(map);
			}
			
			this.saveAll();
			return usedId;
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

        getSrcTileCoordByIndex : function(tileIndex) {
			if (!tileIndex) return null;

			const tilesPerRow = Math.ceil(pal.canvas.width / tileSize);
			const col = (tileIndex -1) % tilesPerRow;
			const row = Math.floor((tileIndex -1) / tilesPerRow);

			return { col, row, tileIndex };
        },

        setTile : function(e) {
			const destTile = this.getTile(e);
			
			this.setTileByCoord(destTile.col, destTile.row, srcTile);
			this.setTileIndex(destTile.col, destTile.row, srcTile.tileIndex);
			
			this.saveMap();
        },
		
		setTileByCoord : function(destCol, destRow, srcTile) {
			map.clearRect(destCol * tileSize, destRow * tileSize, tileSize, tileSize);
			map.drawImage(sprite, srcTile.col * tileSize, srcTile.row * tileSize, tileSize, tileSize, destCol * tileSize, destRow * tileSize, tileSize, tileSize);
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

        eraseTile : function(e) {		
			const destTile = this.getTile(e);
			this.eraseTileByCoord(destTile.col, destTile.row);
			this.setTileIndex(destTile.col, destTile.row, 0);
        },

        eraseTileByCoord : function(col, row) {		
			map.clearRect(col * tileSize, row * tileSize, tileSize, tileSize);
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
			const map = storage.get('map');
			if (!map) return;
			
			tiles = map.tileIndexes;
			this.prepareMapStructure();

			for (let row = 0; row < height; row++) {
				for (let col = 0; col < width; col++) {
					const tileIndex = tiles[row][col];
					const localSrcTile = this.getSrcTileCoordByIndex(tileIndex);
					if (localSrcTile) {
						this.setTileByCoord(col, row, localSrcTile);
					} else {
						this.eraseTileByCoord(col, row);
					}
				}
			}

			mapId = map.id || 0;
			mapName = map.name || 'Unnamed';
			mapNameInput.value = mapName;
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
			tiles.length = height;
			for (let row = 0; row < height; row++) {
				const tilesRow = tiles[row] || [];
				tilesRow.length = width;
				for (let col = 0; col < width; col++) {
					tilesRow[col] = tilesRow[col] || 0;
				}
				tiles[row] = tilesRow;
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

        outputJSON : function() {
			this.prepareMapStructure();
			mapId = maps.upsert(this.getMapObject());
			this.saveMap();
			
			const project = {
				tool: {
					name: APP_NAME,
					version: '0.8.0',
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
			
			tiles = project.maps[0].tileIndexes;
			this.saveMap();
			
			storage.put('tileSet', project.tileSet);

			this.destroy();
			this.init();
		},

		updateSizeVariables : function() {
			const inputToNumber = el => +el.value || 1;
			
			width = inputToNumber(widthInput);
			height = inputToNumber(heightInput);
			tileSize = inputToNumber(tileSizeInput);
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
			tileSizeInput.value = storedSize.tileSize;
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
				tileSetForSms = _this.convertToUnoptimizedTileMap(pal.canvas);
				
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
			 
			[widthInput, heightInput, tileSizeInput, tileZoomInput].forEach(input => {
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
			sprite.src = storedTileSet && storedTileSet.src || 'assets/tilemap_32a.png';
			
            map.canvas.width = width * tileSize;
            map.canvas.height = height * tileSize;
			map.canvas.style.zoom = tileZoom;
			
            this.drawTool();
        },

        destroy : function() {
            clearInterval(draw);
            alpha = [];
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
