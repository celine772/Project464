// MapLibre GL JS map with Wi-Fi and tourist attraction layers.
const map = new maplibregl.Map({
    container: 'map',
    style: 'https://tiles.openfreemap.org/styles/positron',
    center: [-73.5673, 45.5017],
    zoom: 12
});

map.addControl(new maplibregl.NavigationControl(), 'top-right');

const status = document.getElementById('status');
const searchForm = document.getElementById('location-search');
const searchInput = document.getElementById('location-query');
const searchStatus = document.getElementById('search-status');
const suggestions = document.getElementById('search-suggestions');
const layersToggle = document.getElementById('layers-toggle');
const layersPanel = document.getElementById('layers-panel');
let wifiSummary = 'Loading Wi-Fi locations…';
let attractionSummary = 'Loading tourist attractions…';
let fountainSummary = 'Loading public fountains…';
let suggestionTimer;
let suggestionRequest = 0;

layersToggle.addEventListener('click', function () {
    const expanded = layersToggle.getAttribute('aria-expanded') === 'true';
    layersToggle.setAttribute('aria-expanded', String(!expanded));
    layersPanel.hidden = expanded;
});

layersPanel.addEventListener('change', function (event) {
    const layerId = event.target.getAttribute('data-layer-id');
    if (!layerId) { return; }

    const collection = pointCollections.find(function (item) { return item.id === layerId; });
    if (!collection) { return; }

    collection.visible = event.target.checked;
    refreshPointMarkers();
});

searchForm.addEventListener('submit', function (event) {
    event.preventDefault();
    searchLocation(searchInput.value.trim());
});

function isMontrealResult(feature) {
    const coordinates = feature.geometry.coordinates;
    const longitude = coordinates[0];
    const latitude = coordinates[1];
    const properties = feature.properties || {};
    const city = properties.city || properties.locality;
    const isMontreal = !city || city.normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '').toLowerCase() === 'montreal';

    return isMontreal && longitude >= -73.99 && longitude <= -73.45 &&
        latitude >= 45.40 && latitude <= 45.70;
}

function photonSearchUrl(query, limit) {
    return 'https://photon.komoot.io/api/?q=' + encodeURIComponent(query) +
        '&lat=45.5017&lon=-73.5673&limit=' + limit;
}

function closeSuggestions() {
    suggestions.hidden = true;
    searchInput.setAttribute('aria-expanded', 'false');
}

function showSuggestions(features) {
    suggestions.replaceChildren();
    features.forEach(function (feature) {
        const properties = feature.properties || {};
        const streetAddress = [properties.housenumber, properties.street].filter(Boolean).join(' ');
        const primary = properties.name || streetAddress || properties.street || properties.city || 'Location';
        const secondary = [streetAddress, properties.city || properties.locality, properties.state]
            .filter(function (part, index, parts) { return part && part !== primary && parts.indexOf(part) === index; })
            .join(', ');
        const label = secondary ? primary + ' — ' + secondary : primary;
        const option = document.createElement('button');
        option.type = 'button';
        option.setAttribute('role', 'option');
        option.textContent = label;
        option.addEventListener('click', function () { selectSearchResult(feature, label); });
        suggestions.appendChild(option);
    });

    suggestions.hidden = features.length === 0;
    searchInput.setAttribute('aria-expanded', String(features.length > 0));
}

function selectSearchResult(feature, label) {
    searchInput.value = label;
    closeSuggestions();
    searchInput.focus();
    map.flyTo({ center: feature.geometry.coordinates, zoom: 15 });
    searchStatus.textContent = 'Map moved to ' + label + '.';
}

searchInput.addEventListener('input', function () {
    const query = searchInput.value.trim();
    clearTimeout(suggestionTimer);
    const requestId = ++suggestionRequest;

    if (query.length < 2) {
        closeSuggestions();
        searchStatus.textContent = '';
        return;
    }

    suggestionTimer = setTimeout(function () {
        fetch(photonSearchUrl(query, 10))
            .then(function (response) {
                if (!response.ok) { throw new Error('Search request failed'); }
                return response.json();
            })
            .then(function (data) {
                if (requestId !== suggestionRequest) { return; }
                const matches = data.features.filter(isMontrealResult).slice(0, 6);
                showSuggestions(matches);
                searchStatus.textContent = matches.length ?
                    matches.length + ' suggestions available.' : 'No matches found in Montreal';
            })
            .catch(function () {
                if (requestId !== suggestionRequest) { return; }
                closeSuggestions();
                searchStatus.textContent = 'Search suggestions could not be loaded.';
            });
    }, 250);
});

searchInput.addEventListener('keydown', function (event) {
    const options = suggestions.querySelectorAll('button');
    if (event.key === 'ArrowDown' && options.length) {
        event.preventDefault();
        options[0].focus();
    } else if (event.key === 'Escape') {
        closeSuggestions();
    }
});

suggestions.addEventListener('keydown', function (event) {
    const options = Array.from(suggestions.querySelectorAll('button'));
    const currentIndex = options.indexOf(document.activeElement);
    if (event.key === 'ArrowDown' && currentIndex < options.length - 1) {
        event.preventDefault();
        options[currentIndex + 1].focus();
    } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (currentIndex <= 0) { searchInput.focus(); }
        else { options[currentIndex - 1].focus(); }
    } else if (event.key === 'Escape') {
        closeSuggestions();
        searchInput.focus();
    }
});

function searchLocation(query) {
    if (!query) {
        searchStatus.textContent = 'Enter an address or place to search.';
        return;
    }

    closeSuggestions();
    searchStatus.textContent = 'Searching…';
    fetch(photonSearchUrl(query, 10))
        .then(function (response) {
            if (!response.ok) { throw new Error('Search request failed'); }
            return response.json();
        })
        .then(function (data) {
            const result = data.features.find(isMontrealResult);
            if (!result) {
                searchStatus.textContent = 'Address or place could not be found in Montréal.';
                return;
            }

            selectSearchResult(result, query);
        })
        .catch(function () {
            searchStatus.textContent = 'Address or place could not be found in Montréal.';
        });
}

function updateStatus() {
    status.textContent = wifiSummary + ' · ' + attractionSummary + ' · ' + fountainSummary;
}

function makePopupContent(title, details) {
    const content = document.createElement('div');
    const heading = document.createElement('strong');
    heading.textContent = title || 'Location';
    content.appendChild(heading);

    details.forEach(function (detail) {
        if (!detail.value) { return; }
        const line = document.createElement('div');
        line.textContent = detail.label ? detail.label + ': ' + detail.value : detail.value;
        content.appendChild(line);
    });

    return content;
}

function translateWifiType(type) {
    const translations = {
        'arena': 'Arena',
        'bam': 'BAM',
        'bibliotheque': 'Library',
        'bibliotheque, centre communautaire': 'Library, Community Centre',
        'bibliotheque, maison de la culture': 'Library, Cultural Centre',
        'biodome': 'Biodome',
        'biosphere': 'Biosphere',
        'cafe': 'Cafe',
        'centre communautaire': 'Community Centre',
        'centre communautaire, chalet': 'Community Centre, Chalet',
        'centre sportif': 'Sports Centre',
        'chalet': 'Chalet',
        'cour municipale': 'Municipal Court',
        'espace vie': 'Living Space',
        'grand potager': 'Large Vegetable Garden',
        'insectarium': 'Insectarium',
        'intersection': 'Intersection',
        'jardin botanique': 'Botanical Garden',
        'jardins d\'expositions': 'Exhibition Gardens',
        'mairie': 'City Hall',
        'maison de la culture': 'Cultural Centre',
        'musee': 'Museum',
        'parc': 'Park',
        'piscine': 'Pool',
        'planetarium': 'Planetarium'
    };
    const key = type.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return translations[key] || type;
}

const pointCollections = [];
let renderedMarkers = [];
const clusterDistance = 20;

function addClusteredPointLayer(id, data, color, iconPath, popupDetails) {
    const layerToggle = layersPanel.querySelector('[data-layer-id="' + id + '"]');
    pointCollections.push({
        id: id,
        data: data,
        color: color,
        iconPath: iconPath,
        popupDetails: popupDetails,
        visible: layerToggle ? layerToggle.checked : true
    });
    refreshPointMarkers();
}

function findRoot(parents, index) {
    if (parents[index] !== index) {
        parents[index] = findRoot(parents, parents[index]);
    }
    return parents[index];
}

function refreshPointMarkers() {
    renderedMarkers.forEach(function (marker) { marker.remove(); });
    renderedMarkers = [];

    if (!map.getStyle()) { return; }

    const canvas = map.getCanvas();
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    pointCollections.forEach(function (collection) {
        if (!collection.visible) { return; }

        const points = [];

        collection.data.features.forEach(function (feature) {
            const projected = map.project(feature.geometry.coordinates);
            if (projected.x < -clusterDistance || projected.x > width + clusterDistance ||
                projected.y < -clusterDistance || projected.y > height + clusterDistance) {
                return;
            }
            points.push({ feature: feature, x: projected.x, y: projected.y });
        });

        const parents = points.map(function (point, index) { return index; });
        const cells = new Map();

        points.forEach(function (point, index) {
            const cellX = Math.floor(point.x / clusterDistance);
            const cellY = Math.floor(point.y / clusterDistance);

            for (let x = cellX - 1; x <= cellX + 1; x += 1) {
                for (let y = cellY - 1; y <= cellY + 1; y += 1) {
                    const nearby = cells.get(x + ':' + y) || [];
                    nearby.forEach(function (otherIndex) {
                        const other = points[otherIndex];
                        const dx = point.x - other.x;
                        const dy = point.y - other.y;
                        if (dx * dx + dy * dy <= clusterDistance * clusterDistance) {
                            const rootA = findRoot(parents, index);
                            const rootB = findRoot(parents, otherIndex);
                            parents[rootA] = rootB;
                        }
                    });
                }
            }

            const key = cellX + ':' + cellY;
            if (!cells.has(key)) { cells.set(key, []); }
            cells.get(key).push(index);
        });

        const groups = new Map();
        points.forEach(function (point, index) {
            const root = findRoot(parents, index);
            if (!groups.has(root)) { groups.set(root, []); }
            groups.get(root).push(point);
        });

        groups.forEach(function (group) {
            const isCluster = group.length > 1;
            const centerX = group.reduce(function (sum, point) { return sum + point.x; }, 0) / group.length;
            const centerY = group.reduce(function (sum, point) { return sum + point.y; }, 0) / group.length;
            const center = map.unproject([centerX, centerY]);
            const element = document.createElement('button');
            element.type = 'button';
            element.className = isCluster ? 'map-point-cluster' : 'map-point-single';
            element.style.setProperty('--cluster-color', collection.color);
            element.setAttribute('aria-label', isCluster ?
                group.length + ' nearby ' + collection.id + ' locations' : collection.id + ' location');

            if (isCluster) {
                element.textContent = group.length >= 10 ? Math.floor(group.length / 10) * 10 + '+' : group.length;
                element.addEventListener('click', function () {
                    map.easeTo({ center: center, zoom: Math.min(map.getZoom() + 2, 18) });
                });
            } else {
                const feature = group[0].feature;
                const icon = document.createElement('img');
                icon.src = collection.iconPath;
                icon.alt = '';
                icon.setAttribute('aria-hidden', 'true');
                element.appendChild(icon);
                const marker = new maplibregl.Marker({ element: element, anchor: 'center' })
                    .setLngLat(feature.geometry.coordinates)
                    .setPopup(new maplibregl.Popup().setDOMContent(collection.popupDetails(feature.properties)))
                    .addTo(map);
                renderedMarkers.push(marker);
                return;
            }

            const marker = new maplibregl.Marker({ element: element, anchor: 'center' })
                .setLngLat(center)
                .addTo(map);
            renderedMarkers.push(marker);
        });
    });
}

map.on('moveend', refreshPointMarkers);

function loadGeoJSON(path) {
    return fetch(path).then(function (response) {
        if (!response.ok) { throw new Error('HTTP ' + response.status + ' loading ' + path); }
        return response.json();
    });
}

function parseCSV(text) {
    const rows = [];
    let row = [];
    let value = '';
    let quoted = false;

    for (let index = 0; index < text.length; index += 1) {
        const character = text[index];
        if (quoted) {
            if (character === '"' && text[index + 1] === '"') {
                value += '"';
                index += 1;
            } else if (character === '"') {
                quoted = false;
            } else {
                value += character;
            }
        } else if (character === '"') {
            quoted = true;
        } else if (character === ',') {
            row.push(value);
            value = '';
        } else if (character === '\n' || character === '\r') {
            if (character === '\r' && text[index + 1] === '\n') { index += 1; }
            row.push(value);
            if (row.some(function (cell) { return cell !== ''; })) { rows.push(row); }
            row = [];
            value = '';
        } else {
            value += character;
        }
    }

    if (value !== '' || row.length > 0) {
        row.push(value);
        rows.push(row);
    }

    const headers = rows.shift().map(function (header) { return header.replace(/^\uFEFF/, ''); });
    return rows.map(function (cells) {
        return headers.reduce(function (record, header, index) {
            record[header] = cells[index] || '';
            return record;
        }, {});
    });
}

function loadFountains() {
    return fetch('../Data/Public_Fountains.csv').then(function (response) {
        if (!response.ok) { throw new Error('HTTP ' + response.status + ' loading Public_Fountains.csv'); }
        return response.text();
    }).then(function (text) {
        const features = parseCSV(text)
            .filter(function (row) {
                return !Object.values(row).some(function (value) {
                    return value.toLowerCase().includes('accès restreint');
                });
            })
            .map(function (row) {
                return {
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [Number(row.Longitude), Number(row.Latitude)]
                    },
                    properties: row
                };
            })
            .filter(function (feature) {
                return Number.isFinite(feature.geometry.coordinates[0]) &&
                    Number.isFinite(feature.geometry.coordinates[1]);
            });

        return { type: 'FeatureCollection', features: features };
    });
}

updateStatus();

function loadPointData() {
    loadGeoJSON('../Data/internet.geojson')
        .then(function (data) {
            const shown = {
                type: 'FeatureCollection',
                features: data.features.slice(0, Infinity)
            };

            addClusteredPointLayer('wifi', shown, '#111827', '../Images/wifi.svg', function (properties) {
                return makePopupContent('Free WIFI spot', [
                    { value: translateWifiType(properties.wifi_type) },
                    {
                        label: 'Address',
                        value: properties.lieu.replace(/\b[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ -]?\d[ABCEGHJ-NPRSTV-Z]\d\b/gi, '').trim()
                    }
                ]);
            });

            wifiSummary = shown.features.length + ' of ' + data.features.length + ' Wi-Fi locations shown';
            updateStatus();
        })
        .catch(function (error) {
            wifiSummary = 'Could not load Wi-Fi locations';
            updateStatus();
            console.error(error);
        });

    loadGeoJSON('../Data/tourist_attractions.geojson')
        .then(function (data) {
            addClusteredPointLayer('landmarks', data, '#dc2626', '../Images/pin.svg', function (properties) {
                return makePopupContent(properties.name, [
                    { value: properties.type },
                    { label: 'Arrondissement', value: properties.borough }
                ]);
            });

            attractionSummary = data.features.length + ' tourist attractions shown';
            updateStatus();
        })
        .catch(function (error) {
            attractionSummary = 'Could not load tourist attractions';
            updateStatus();
            console.error(error);
        });

    loadFountains()
        .then(function (data) {
            addClusteredPointLayer('fountains', data, '#2563eb', '../Images/glass-water%20(1).svg', function (properties) {
                return makePopupContent('Public Water Fountain', [
                    { label: 'Address', value: properties.Intersection }
                ]);
            });

            fountainSummary = data.features.length + ' public fountains shown';
            updateStatus();
        })
        .catch(function (error) {
            fountainSummary = 'Could not load public fountains';
            updateStatus();
            console.error(error);
        });
}

loadPointData();