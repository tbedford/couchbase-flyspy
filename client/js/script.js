console.log('---- MAP CLIENT ----');
const map = L.map('map').setView(MAP_EXTENT, MAP_ZOOM_LEVEL);
const markersLayer = new L.LayerGroup();
markersLayer.addTo(map);

let lastEvents = null;
let autoload = null;

const defaultLayer = L.tileLayer(
	'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
	{
		attribution:
			'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
	}
).addTo(map);

const baseLayers = {
	OSM: defaultLayer,
	'Stamen Toner': L.tileLayer.provider('Stamen.Toner'),
	'Stamen Terrain': L.tileLayer.provider('Stamen.Terrain'),
	'Stamen Watercolor': L.tileLayer.provider('Stamen.Watercolor'),
	'Esri WorldStreetMap': L.tileLayer.provider('Esri.WorldStreetMap'),
	'Esri WorldTopoMap': L.tileLayer.provider('Esri.WorldTopoMap'),
	'Esri WorldImagery': L.tileLayer.provider('Esri.WorldImagery'),
	'Esri WorldShadedRelief': L.tileLayer.provider('Esri.WorldShadedRelief'),
	'Esri NatGeoWorldMap': L.tileLayer.provider('Esri.NatGeoWorldMap'),
	'Esri WorldGrayCanvas': L.tileLayer.provider('Esri.WorldGrayCanvas'),
};

var overlayLayers = {
	Incidents: markersLayer,
};

var layerControl = L.control
	.layers(baseLayers, overlayLayers, {
		collapsed: true,
	})
	.addTo(map);

console.log('---- DEBUG -----')
getEvents();

async function getEvents () {
	const response = await fetch(EVENT_SERVER_URL);
	const events = await response.json();
    console.log(events);
	if (JSON.stringify(events) == JSON.stringify(lastEvents)) {
		console.log('No event changes');
		return;
	}
	console.log('Retrieved new events'+events);

	markersLayer.clearLayers();
	events.forEach((item, index) => {
		if (item.location) {
			geocode(item.location)
				.then(data => {
					const coords = {
						lng: data.results[0].geometry.lng,
						lat: data.results[0].geometry.lat,
					};
					console.log(
						`Geocoded ${item.location} at lng: ${coords.lng}, lat: ${coords.lat}`
					);
					drawMarker(coords, item);
				})
				.catch(error => {
					console.error(error);
				});
		} else {
			console.log(`Item ${index} has no information to geocode from`);
		}
	});
	lastEvents = [].concat(events);
}

async function geocode (location) {
	const queryURL = `https://api.opencagedata.com/geocode/v1/json?q=${location}&key=${API_KEY}`;
	const response = await fetch(queryURL);
	const data = await response.json();
	return data;
}

function drawMarker (coords, event) {
	const latLng = new L.latLng([ coords.lat, coords.lng ]); // The coordintaes are in a [<lng>, <lat>] format
	let severityFactor = '';

	switch (event.severity) {
		case 1:
			severityFactor = '<em>Not good</em>';
			break;
		case 2:
			severityFactor = '<em>Bad</em>';
			break;
		case 3:
			severityFactor = '<em>Really, really, bad</em>';
			break;
	}

	const markerContent = `<b>${event.description}</b><br/><img src="${event.url}" height="150px" width="150px"/><br/><b>Severity</b>: ${severityFactor}`;

	let markerIcon = null;
	switch (event.severity) {
		case 1:
			markerIcon = greenIcon;
			break;
		case 2:
			markerIcon = orangeIcon;
			break;
		case 3:
			markerIcon = redIcon;
			break;
	}
	new L.marker(latLng)
		.setIcon(markerIcon)
		.bindPopup(markerContent)
		.bindTooltip(event.description)
		.addTo(markersLayer);
}

function refresh () {
	// fudge this by forcing difference
	lastEvents = null;
	markersLayer.clearLayers();
	getEvents();
	map.setView([ 51.558, -1.78 ], 12);
	console.log('Refreshing map');
}

function liveReload () {
	const button = document.getElementById('refreshButton');
	if (toggle.checked == true) {
		autoload = setInterval(getEvents, 1000);
		button.disabled = true;
		button.className = 'button:disabled';
	} else {
		clearInterval(autoload);
		button.disabled = false;
		button.className = 'button';
	}
}
