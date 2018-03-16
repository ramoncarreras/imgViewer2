/*
 * imgViewer2
 * 
 *
 * Copyright (c) 2013 Wayne Mogg
 * Licensed under the MIT license.
 */




/*
 *	imgViewer2 plugin starts here
 */
;(function($) {
	$.widget("wgm.imgViewer2", {
		options: {
            imgURL: undefined,
			zoomMax: undefined,
			zoomable: true,
			dragable: true,
            constraint: undefined,
            leafletOptions: {},
			onClick: $.noop,
			onReady: $.noop
		},
		
		_create: function() {
			var self = this;
            self.map = undefined;
            self.baseImg = undefined;
            self.ready=false;
            self.container = self.element[0].id;
            if (document.getElementById(self.container)) {
                self.map = L.map(self.container, $.extend({crs:L.CRS.Simple, zoomSnap:0},self.options.leafletOptions));
                self._loadBaseImage(this.options.imgURL, function() {
                    self._process_zoomable();
                    self._process_dragable();
                    self._process_zoomMax();

                    self.map.on('click', function(ev) {
                        if (self.options.onClick !== null) {
                            self.options.onClick.call(self, ev.originalEvent, self.eventToImg(ev));
                        }
                    });

                    self.options.onReady.call(self);
                });
            }
		},
/*
 *	Remove the plugin
 */  
		destroy: function() {
			this.map.remove();
			$.Widget.prototype.destroy.call(this);
		},
        
        _loadBaseImage: function(url, callback) {
            var self = this;
            if (self.map.hasLayer(self.baseImage)) {
                self.map.removeLayer(self.baseImg);
                self.baseImg = undefined;
            }
            var img = new Image();
            img.src = url;
            $(img).one('load', function() {
                self.ready = true;
                self.imgwidth = this.naturalWidth;
                self.imgheight = this.naturalHeight;
                self.bounds = L.latLngBounds(L.latLng(0,0), L.latLng(self.imgheight,self.imgwidth));
                self.zimg = L.imageOverlay(self.options.imgURL, self.bounds).addTo(self.map);
                self.map.setMaxBounds(self.bounds);
                self.map.setMinZoom(-2000);
                self.map.fitBounds(self.bounds);
                self.map.setMinZoom(self.map.getZoom());
                self.setZoom(1);
                
                callback();
            });
            $(img).on('error', function() {
                alert("Image file not found");
            });
        },
        
        _setOption: function(key, value) {
            switch(key) {
				case 'zoomMax':
					if (parseFloat(value) < 1 || isNaN(parseFloat(value))) {
						return;
					}
					break;
			}
			var version = $.ui.version.split('.');
			if (version[0] > 1 || version[1] > 8) {
				this._super(key, value);
			} else {
				$.Widget.prototype._setOption.apply(this, arguments);
			}
			switch(key) {
                case 'imgURL':
                    this._loadBaseImage(this.options.imgURL);
                    break;
				case 'zoomMax':
                    this._process_zoomMax();
					break;
				case 'zoomable':
                    this._process_zoomable();
					break;
				case 'dragable':
                    this._process_dragable();
					break;
			}
		},
        
        _process_zoomable: function() {
            if (this.options.zoomable) {
                this.map.zoomControl.enable();
                this.map.boxZoom.enable();
                this.map.touchZoom.enable();
                this.map.doubleClickZoom.enable();
                this.map.scrollWheelZoom.enable();
            } else {
                this.map.zoomControl.disable();
                this.map.boxZoom.disable();
                this.map.touchZoom.disable();
                this.map.doubleClickZoom.disable();
                this.map.scrollWheelZoom.disable();
            }
        },
        
        _process_dragable: function() {
            if (this.options.dragable) {
                this.map.dragging.enable();
            } else {
                this.map.dragging.disable();
            }
        },
        
        _process_zoomMax: function() {
            if (this.ready && this.options.zoomMax !== undefined) {
                lzoom = this.leafletZoom(this.options.zoomMax);
                if (lzoom < this.map.getZoom()) {
                    this.map.setZoom(lzoom);
                }
                this.map.options.maxZoom = lzoom;
                this.map.fire('zoomend');
            }
        },
/*
 *	Test if a relative image coordinate is visible in the current view
 */
		isVisible: function(relx, rely) {
			var view = this.getView();
			if (view) {
				return (relx >= view.left && relx <= view.right && rely >= view.top && rely <= view.bottom);
			} else {
				return false;
			}
		},
/*
 *	Convert a user supplied zoom to a Leaflet zoom
*/
		leafletZoom: function(zoom) {
			if (this.ready && zoom !== undefined) {
				var map = this.map,
					lzoom = map.getZoom() || 0,
					size = map.getSize(),
					width = this.imgwidth,
					height = this.imgheight,
					nw = L.latLng(height/zoom,width/zoom),
					se = L.latLng(0,0),
					boundsSize = map.project(nw, lzoom).subtract(map.project(se, lzoom));

				var scale = Math.min(size.x / boundsSize.x, -size.y / boundsSize.y);
				return map.getScaleZoom(scale, lzoom);
			} else {
				return undefined;
			}
		},
/*
 *	Get the Leaflet map object
*/
		getMap: function() {
			if (this.ready) {
				return this.map;
			}
			else {
				return null;
			}
		},
/*
 *	Get current zoom level
 *	Returned zoom will always be >=1
 *	a zoom of 1 means the entire image is just visible within the viewport
 *	a zoom of 2 means half the image is visible in the viewport etc
*/
		getZoom: function() {
			if (this.ready) {
				var map = this.map,
					width = this.imgwidth,
					height = this.imgheight,
					constraint = this.options.constraint,
					bounds = map.getBounds();
				if (constraint == 'width' ) {
					return Math.max(1, width/(bounds.getEast()-bounds.getWest()));
				} else if (constraint == 'height') {
					return Math.max(1,height/(bounds.getNorth()-bounds.getSouth()));
				} else {
					return Math.max(1, (width/(bounds.getEast()-bounds.getWest()) + height/(bounds.getNorth()-bounds.getSouth()))/2);
				}
			} else {
				return null;
			}
		},
/*
 *	Set the zoom level
 *	Zoom must be >=1
 *	a zoom of 1 means the entire image is just visible within the viewport
 *	a zoom of 2 means half the image is visible in the viewport etc
*/
		setZoom: function( zoom ) {
			if (this.ready) {
				zoom = Math.max(1, zoom);
				if (this.options.zoomMax === undefined) {
				} else {
					zoom = Math.min(zoom, this.options.zoomMax);
				}
				var map = this.map,
					width = this.imgwidth,
					height = this.imgheight,
					constraint = this.options.constraint,
					center = map.getCenter(),
					bounds = map.getBounds();
				var hvw, hvh;
				if (constraint == 'width') {
					hvw = width/zoom/2;
					hvh = hvw * (bounds.getNorth()-bounds.getSouth())/(bounds.getEast()-bounds.getWest());
				} else if (constraint == 'height') {
					hvh = height/zoom/2;
					hvw = hvh * (bounds.getEast()-bounds.getWest())/(bounds.getNorth()-bounds.getSouth());
				} else {
					hvw = width/zoom/2;
					hvh = height/zoom/2;
				}
						
				var	east = center.lng + hvw,
					west = center.lng - hvw,
					north = center.lat + hvh,
					south = center.lat - hvh;
				if (west<0) {
					east += west;
					west = 0;
				} else if (east > width) {
					west -= east-width;
					east = width;
				}
				if (south<0) {
					north -= south;
					south = 0;
				} else if (north > height) {
					south -= north-height;
					north = height;
				}
				map.fitBounds(L.latLngBounds(L.latLng(south,west), L.latLng(north,east)),{animate:false});
                this.map.fire('zoomend');
			}
			return this;
		},
/*
 *	Get relative image coordinates of current view
 */
		getView: function() {
			if (this.ready) {
				var width = this.imgwidth,
					height = this.imgheight,
					bnds = this.map.getBounds();
			 return {
					top: 1 - bnds.getNorth()/height,
					left: bnds.getWest()/width,
					bottom: 1 - bnds.getSouth()/height,
					right: bnds.getEast()/width
				};
			} else {
				return null;
			}
		},
/*
 *	Pan the view to be centred at the given relative image location
 */
		panTo: function(relx, rely) {
			if ( this.ready && relx >= 0 && relx <= 1 && rely >= 0 && rely <=1 ) {
				var map = this.map,
					bounds = map.getBounds(),
					east = bounds.getEast(),
					west = bounds.getWest(),
					north = bounds.getNorth(),
					south = bounds.getSouth(),
					centerX = (east+west)/2,
					centerY = (north+south)/2,
					width = this.imgwidth,
					height = this.imgheight,
					newY = (1-rely)*height,
					newX = relx*width;
				east += newX - centerX;
				west += newX - centerX;
				north += newY - centerY;
				south += newY - centerY;
                if (west<0) {
                    east -= west;
                    west = 0;
                }
                if (east > width) {
                    west -= east-width;
                    east = width;
                }
                if (south<0) {
                    north -= south;
                    south = 0;
                }
                if (north > height) {
                    south -= north-height;
                    north = height;
                }
                map.fitBounds(L.latLngBounds(L.latLng(south,west), L.latLng(north,east)),{animate:false});
			}
			return this;
		},
/*
 *	Return the relative image coordinate for a Leaflet event 
 */		
		eventToImg: function(ev) {
			if (this.ready) {
				var width = this.imgwidth,
					height = this.imgheight,
                    relx = ev.latlng.lng/width,
                    rely = 1 - ev.latlng.lat/height;
				if (relx>=0 && relx<=1 && rely>=0 && rely<=1) {
					return {x: relx, y: rely};
				} else {
					return null;
				}
			} else {
				return null;
			}
		},
/*
 * Convert relative image coordinate to Leaflet LatLng point
 */
		relposToLatLng: function(x,y) {
			if (this.ready) {
				var width = this.imgwidth,
					height = this.imgheight;
				return L.latLng((1-y)*height, x*width);
			} else {
				return null;
			}
		},
/*
 * Convert relative image coordinate to Image pixel
 */
		relposToImage: function(pos) {
			if (this.ready) {
				var width = this.imgwidth,
					height = this.imgheight;
				return {x: Math.round(pos.x*width), y: Math.round(pos.y*height)};
			} else {
				return null;
			}
		}
	});
})(jQuery);
