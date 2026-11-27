// MapLibre GL JS map with Wi-Fi and tourist attraction layers.
const map = new maplibregl.Map({
    container: 'map',
    style: 'https://tiles.openfreemap.org/styles/positron',
    center: [-73.5673, 45.5017],
    zoom: 12
});
const memory = addMemory(map);

map.addControl(new maplibregl.NavigationControl(), 'top-right');

const status = document.getElementById('status');
const searchForm = document.getElementById('location-search');
const searchInput = document.getElementById('location-query');
const searchStatus = document.getElementById('search-status');
const suggestions = document.getElementById('search-suggestions');
const favoritesStatus = document.getElementById('favorites-status');
const favoritesList = document.getElementById('favorites-list');
const layersToggle = document.getElementById('layers-toggle');
const layersPanel = document.getElementById('layers-panel');
const loadErrors = [];
let suggestionTimer;
let suggestionRequest = 0;
let searchMarker = null;

function renderFavorites() {
    const favorites = memory.getFavorites();
    favoritesList.replaceChildren();
    favoritesStatus.textContent = favorites.length ?
        favorites.length + ' saved location' + (favorites.length === 1 ? '' : 's') +
        ' — stored in this browser.' : 'No favorite locations saved yet.';

    favorites.forEach(function (favorite) {
        const item = document.createElement('li');
        const visit = document.createElement('button');
        visit.type = 'button';
        visit.className = 'favorite-visit';
        visit.textContent = favorite.label;
        visit.addEventListener('click', function () {
            map.flyTo({ center: [favorite.lng, favorite.lat], zoom: 16 });
        });

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'favorite-remove';
        remove.textContent = 'Remove';
        remove.setAttribute('aria-label', 'Remove favorite ' + favorite.label);
        remove.addEventListener('click', function () {
            if (memory.removeFavorite(favorite.id)) {
                renderFavorites();
            } else {
                favoritesStatus.textContent = 'This browser could not update saved locations.';
            }
        });

        item.append(visit, remove);
        favoritesList.appendChild(item);
    });
}

renderFavorites();

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
        const row = document.createElement('div');
        row.className = 'search-suggestion-row';

        const select = document.createElement('button');
        select.type = 'button';
        select.className = 'suggestion-select';
        select.textContent = label;
        select.setAttribute('aria-label', 'Show ' + label + ' on the map');
        select.addEventListener('click', function () { selectSearchResult(feature, label); });

        const coordinates = feature.geometry.coordinates;
        const alreadyFavorite = memory.getFavorites().some(function (favorite) {
            return favorite.lng === Number(coordinates[0]) && favorite.lat === Number(coordinates[1]);
        });
        const star = document.createElement('button');
        star.type = 'button';
        star.className = 'suggestion-favorite';
        star.textContent = alreadyFavorite ? '★' : '☆';
        star.disabled = alreadyFavorite;
        star.setAttribute('aria-label', alreadyFavorite ? label + ' is already a favorite' : 'Save ' + label + ' as a favorite');
        star.title = alreadyFavorite ? 'Already a favorite' : 'Save as favorite';
        star.addEventListener('click', function () {
            const result = memory.addFavorite(coordinates, label);
            if (result.ok) {
                star.textContent = '★';
                star.disabled = true;
                star.setAttribute('aria-label', label + ' is already a favorite');
                star.title = 'Already a favorite';
                renderFavorites();
                favoritesStatus.textContent = 'Saved “' + label + '” in this browser.';
            } else if (result.reason === 'duplicate') {
                star.textContent = '★';
                star.disabled = true;
                star.setAttribute('aria-label', label + ' is already a favorite');
                star.title = 'Already a favorite';
                favoritesStatus.textContent = 'That location is already a favorite.';
            } else {
                favoritesStatus.textContent = result.reason === 'storage' ?
                    'This browser could not save the favorite.' : 'This location could not be saved.';
            }
        });

        row.append(select, star);
        suggestions.appendChild(row);
    });

    suggestions.hidden = features.length === 0;
}

function selectSearchResult(feature, label) {
    searchInput.value = label;
    closeSuggestions();
    searchInput.focus();
    if (searchMarker) { searchMarker.remove(); }
    searchMarker = new maplibregl.Marker({ color: '#A65D43' })
        .setLngLat(feature.geometry.coordinates)
        .setPopup(new maplibregl.Popup({ offset: 25 }).setText(label))
        .addTo(map);
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
    const buttons = suggestions.querySelectorAll('button:not(:disabled)');
    if (event.key === 'ArrowDown' && buttons.length) {
        event.preventDefault();
        buttons[0].focus();
    } else if (event.key === 'Escape') {
        closeSuggestions();
    }
});

suggestions.addEventListener('keydown', function (event) {
    const buttons = Array.from(suggestions.querySelectorAll('button:not(:disabled)'));
    const currentIndex = buttons.indexOf(document.activeElement);
    if (event.key === 'ArrowDown' && currentIndex < buttons.length - 1) {
        event.preventDefault();
        buttons[currentIndex + 1].focus();
    } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (currentIndex <= 0) { searchInput.focus(); }
        else { buttons[currentIndex - 1].focus(); }
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

function showLoadError(message) {
    loadErrors.push(message);
    status.textContent = loadErrors.join(' · ');
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

map.on('load', refreshPointMarkers);
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

function loadPointData() {
    loadGeoJSON('../Data/internet.geojson')
        .then(function (data) {
            const shown = {
                type: 'FeatureCollection',
                features: data.features.slice(0, Infinity)
            };

            addClusteredPointLayer('wifi', shown, '#111827', '../Images/wifi.svg', function (properties) {
                const wifiAddress = typeof properties.lieu === 'string'
                    ? properties.lieu.replace(/\b[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ -]?\d[ABCEGHJ-NPRSTV-Z]\d\b/gi, '').trim()
                    : '';

                return makePopupContent('Free WIFI spot', [
                    { value: translateWifiType(properties.wifi_type) },
                    wifiAddress
                        ? { label: 'Address', value: wifiAddress }
                        : { value: 'No recorded address' }
                ]);
            });

        })
        .catch(function (error) {
            showLoadError('Wi-Fi locations could not be loaded');
            console.error(error);
        });

    loadGeoJSON('../Data/tourist_attractions.geojson')
        .then(function (data) {
            fetch('../Data/Touristspots.csv')
                .then(function (response) {
                    if (!response.ok) { throw new Error('HTTP ' + response.status + ' loading Touristspots.csv'); }
                    return response.text();
                })
                .then(function (text) {
                    const addressesById = new Map();
                    const englishNamesById = {
                        '207': 'Anjou Metropolitan Golf Course',
                        '1103': 'Montréal Biodôme',
                        '1160': 'Rio Tinto Alcan Planetarium',
                        '1615': 'Montréal Island Golf Course',
                        '1770': 'Montréal Municipal Golf Course',
                        '1784': 'Montréal Insectarium',
                        '1785': 'Montréal Botanical Garden',
                        '2389': 'Atrium Le 1000',
                        '2421': 'Montréal Casino',
                        '2721': 'Place Ville-Marie Observatory',
                        '2728': 'La Ronde Six Flags',
                        '2784': 'Grévin Museum Montréal',
                        '2821': 'Beaver Lake Pavilion',
                        '2840': 'Place des Arts',
                        '2862': 'Clock Tower Beach',
                        '2863': 'Jean-Doré Beach',
                        '2976': 'Montréal Old Port',
                        '3438': 'Frédéric-Back Tree House'
                    };

                    parseCSV(text).forEach(function (row) {
                        const number = row['Numéro'] ? row['Numéro'].trim() : '';
                        const street = row['rue'] ? row['rue'].trim() : '';
                        const city = row['Ville'] ? row['Ville'].trim() : '';
                        const postalCode = row['Code postal'] ? row['Code postal'].trim() : '';
                        const addressParts = [number + (street ? ' ' + street : ''), city, postalCode]
                            .filter(function (part) { return part.trim(); });

                        addressesById.set(String(row.ID), addressParts.join(', '));
                    });

                    data.features.forEach(function (feature) {
                        const id = String(feature.properties.id);
                        feature.properties.englishName = englishNamesById[id] || feature.properties.name;
                        feature.properties.address = addressesById.get(id) || '';
                    });

                    addClusteredPointLayer('landmarks', data, '#dc2626', '../Images/pin.svg', function (properties) {
                        return makePopupContent('Attraction', [
                            { value: properties.englishName },
                            { label: 'Address', value: properties.address }
                        ]);
                    });
                })
                .catch(function (error) {
                    showLoadError('Tourist attraction addresses could not be loaded');
                    console.error(error);
                });

        })
        .catch(function (error) {
            showLoadError('Tourist attractions could not be loaded');
            console.error(error);
        });

    loadFountains()
        .then(function (data) {
            addClusteredPointLayer('fountains', data, '#2563eb', '../Images/glass-water%20(1).svg', function (properties) {
                const fountainAddress = typeof properties.Intersection === 'string'
                    ? properties.Intersection.trim()
                    : '';

                return makePopupContent('Public Water Fountain', [
                    fountainAddress
                        ? { label: 'Address', value: fountainAddress }
                        : { value: 'No recorded address' }
                ]);
            });

        })
        .catch(function (error) {
            showLoadError('Public fountain locations could not be loaded.');
            console.error(error);
        });
}

loadPointData();