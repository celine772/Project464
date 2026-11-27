/* GEOG 464 memory.js: save favorite locations in this browser. */


const MEMORY = {
    storageKey: "geog464-favorite-addresses",
    markerColour: "#a65d43"
};


function addMemory(map) {
    let favorites = [];
    const markers = new Map();

    try {
        const saved = JSON.parse(localStorage.getItem(MEMORY.storageKey) || "[]");
        if (Array.isArray(saved)) {
            favorites = saved.filter(function (favorite) {
                return favorite && typeof favorite.id === "string" &&
                    typeof favorite.label === "string" &&
                    Number.isFinite(favorite.lng) && Number.isFinite(favorite.lat);
            });
        }
    } catch (error) {
        favorites = [];
    }

    function renderMarkers() {
        markers.forEach(function (marker) { marker.remove(); });
        markers.clear();

        favorites.forEach(function (favorite) {
            const element = document.createElement("button");
            element.type = "button";
            element.className = "favorite-map-marker";
            element.textContent = "★";
            element.setAttribute("aria-label", "Favorite: " + favorite.label);
            element.style.setProperty("--favorite-color", MEMORY.markerColour);

            const popup = document.createElement("div");
            popup.textContent = favorite.label;
            const marker = new maplibregl.Marker({ element: element, anchor: "bottom" })
                .setLngLat([favorite.lng, favorite.lat])
                .setPopup(new maplibregl.Popup({ offset: 24 }).setDOMContent(popup))
                .addTo(map);
            markers.set(favorite.id, marker);
        });
    }

    function save(nextFavorites) {
        try {
            localStorage.setItem(MEMORY.storageKey, JSON.stringify(nextFavorites));
            favorites = nextFavorites;
            renderMarkers();
            return true;
        } catch (error) {
            return false;
        }
    }

    renderMarkers();

    return {
        getFavorites: function () { return favorites.map(function (favorite) { return { ...favorite }; }); },
        addFavorite: function (coordinates, label) {
            const lng = Number(coordinates[0]);
            const lat = Number(coordinates[1]);
            if (!Number.isFinite(lng) || !Number.isFinite(lat) || !label) {
                return { ok: false, reason: "invalid" };
            }
            const duplicate = favorites.some(function (favorite) {
                return favorite.lng === lng && favorite.lat === lat;
            });
            if (duplicate) { return { ok: false, reason: "duplicate" }; }

            const favorite = {
                id: Date.now().toString(36) + Math.random().toString(36).slice(2),
                label: label,
                lng: lng,
                lat: lat
            };
            return save([favorite].concat(favorites)) ? { ok: true } : { ok: false, reason: "storage" };
        },
        removeFavorite: function (id) {
            const nextFavorites = favorites.filter(function (favorite) { return favorite.id !== id; });
            return save(nextFavorites);
        }
    };
}