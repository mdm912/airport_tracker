import L from 'leaflet';
import { createLayerComponent, LayerProps, updateGridLayer } from '@react-leaflet/core';
import { useMap } from 'react-leaflet';
import React from 'react';

interface MaskedTACTileLayerProps extends L.TileLayerOptions {
  url: string;
  corners: [number, number][]; // [lat, lng][] (NW, NE, SE, SW)
}

// Custom Leaflet Layer using Canvas for Clipping
const MaskedTileLayer = L.TileLayer.extend({
  initialize: function (url: string, options: any) {
    L.TileLayer.prototype.initialize.call(this, url, options);
    this.corners = options.corners;
  },

  createTile: function (coords: L.Coords, done: L.DoneCallback) {
    const tile = document.createElement('canvas');
    tile.width = tile.height = 256;
    const ctx = tile.getContext('2d')!;

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      // 1. Calculate the clip path for this specific tile
      const map = this._map;
      const tileSize = this.getTileSize();
      const nwPoint = coords.scaleBy(tileSize);
      
      ctx.beginPath();
      
      // Convert 4 LatLng corners to tile-pixel coordinates
      this.corners.forEach((corner: [number, number], i: number) => {
        const p = map.project(corner, coords.z)._subtract(nwPoint);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      
      ctx.closePath();
      ctx.clip();

      // 2. Draw the actual map imagery
      ctx.drawImage(img, 0, 0);
      done(null, tile);
    };
    img.onerror = (err) => done(err, tile);
    img.src = this.getTileUrl(coords);

    return tile;
  }
});

const createMaskedLayer = (props: MaskedTACTileLayerProps, context: any) => {
  const instance = new (MaskedTileLayer as any)(props.url, props);
  return { instance, context };
};

const updateMaskedLayer = (instance: L.TileLayer, props: MaskedTACTileLayerProps, prevProps: MaskedTACTileLayerProps) => {
    updateGridLayer(instance, props, prevProps);
    if (props.corners !== prevProps.corners) {
        (instance as any).corners = props.corners;
        instance.redraw();
    }
};

export const MaskedTACTileLayer = createLayerComponent<L.TileLayer, MaskedTACTileLayerProps>(
  createMaskedLayer,
  updateMaskedLayer
);
