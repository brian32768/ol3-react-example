import {Map, View, Overlay, Feature} from 'ol';
import {OSM, Vector as VectorSource} from 'ol/source';
import {Tile as TileLayer, Vector as VectorLayer} from 'ol/layer';
import {Point} from 'ol/geom';
import {getTransform} from 'ol/proj';

import React from 'react';

import {createStore} from 'redux';
import {Provider, connect} from 'react-redux';

import "ol/ol.css";
import "./popup.css";

// This is certainly one way to get an asset into the app with Parcel.
// Since this file has a 'json' extension, the 'require' function
// will parse it and return a JavaScript object.
// The asset is actually loaded at compile time so it becomes part of the bundle,
// so compiled in as a JSON object. The problem for Openlayers is that
// it can't directly read the JSON so I have iterate over it and add points
// one at a time!
let json = require('/OSGEoLabs.json');
//console.log(JSON.stringify(json, null, 3))

let map = new Map({
  target: 'map',
  layers: [
    new TileLayer({
      source: new OSM()
    })
  ],
  view: new View({
    center: [949282, 6002552],
    zoom: 4
  })
});

// Get a function to transform lat,lon points into map space.
let dest_sref = map.getView().getProjection();
let transform = getTransform("EPSG:4326", dest_sref);

// Load all the GEOJSON points into a source
let placeSource = new VectorSource();
json.features.forEach( function( item ) {
    let coordinates = transform(item.geometry.coordinates);
    let point = new Point(coordinates);
    //console.log(point);
    let feature = new Feature({
        geometry: point,
        name: item.properties.name
    });
    placeSource.addFeature(feature);
});
// Add the source to a layer, and add the layer to the map.
let placeLayer = new VectorLayer({
    source: placeSource
});
map.addLayer(placeLayer);

let popupElement = document.getElementById('popup');
let popup = new Overlay({
  element: popupElement,
  autoPan: true,
  autoPanAnimation: {
    duration: 250
  }
});
map.addOverlay(popup);

function placeName(place) {
    // extract text from link
    return place.name.replace(/<(?:.|\n)*?>/g, '');
}

// OL callbacks
function updateVisiblePlaces() {
  var extent = map.getView().calculateExtent(map.getSize());
  var places = placeLayer.getSource().getFeaturesInExtent(extent).map(function(feature) {
    return feature.getProperties();
  });
  // Update state in Redux store
  store.dispatch(visiblePlacesAction(places))
}
placeLayer.on('change', updateVisiblePlaces);
map.on('moveend', updateVisiblePlaces);

function updateSelection(name) {
  var extent = map.getView().calculateExtent(map.getSize());
  var selected = placeLayer.getSource().getFeaturesInExtent(extent).filter(function(feature) {
    return name == placeName(feature.getProperties());
  });
  if (selected.length > 0) {
    let feature = selected[0];
    popupElement.innerHTML = feature.getProperties().name;
    popup.setPosition(feature.getGeometry().getFirstCoordinate());
  }
}

// React component
var PlaceList = React.createClass( {
  render: function() {
    var onSelectClick = this.props.onSelectClick;
    var selected = this.props.selected;
    var createItem = function(place) {
      var name = placeName(place);
      var selClass = (name == selected) ? 'selected' : '';
      return <li key={name} className={selClass} onClick={onSelectClick}>{name}</li>;
    };
    return (
      <ul>
        {this.props.places.map(createItem)}
      </ul>
    );
  }
});

// Actions:
function visiblePlacesAction(places) {
  return {
    type: 'visible',
    places: places
  };
}

function selectAction(placeName) {
  return {
    type: 'select',
    placeName: placeName
  };
}

// Reducer:
function placeSelector(state, action) {
  if (typeof state === 'undefined') {
    state = {places: [], selected: null};
  }
  switch(action.type){
    case 'visible':
      return {places: action.places, selected: state.selected};
    case 'select':
      return {places: state.places, selected: action.placeName};
    default:
      return state;
  }
}

// Store:
var store = createStore(placeSelector);

// Map Redux state to component props
function mapStateToProps(state)  {
  return {
    places: state.places,
    selected: state.selected
  };
}

// Map Redux actions to component props
function mapDispatchToProps(dispatch) {
  return {
    onSelectClick: function(e) {
      name = e.dispatchMarker.split('$')[1];
      dispatch(selectAction(name));
      // Update map
      updateSelection(name)
    }
  };
}

// Connected Component:
var App = connect(
  mapStateToProps,
  mapDispatchToProps
)(PlaceList);

React.render(
  React.createElement(Provider, {store: store},
    function(){
      return (<App/>)
    }
  ),
  document.getElementById('root')
);


module.exports = PlaceList;
