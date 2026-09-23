/* =====================================================
   SURU COLLECTION — DELIVERY LOCATION PICKER
   Uses browser geolocation + Leaflet/OpenStreetMap.
   Coordinates are stored separately from the written
   address so hard-to-find addresses remain deliverable.
===================================================== */

(function () {
  "use strict";

  const DEFAULT_LAT = 26.7645; // Gaur
  const DEFAULT_LNG = 85.2786;

  function byId(id) {
    return document.getElementById(id);
  }

  function formatCoord(value) {
    return Number(value).toFixed(6);
  }

  function createMapPicker(config) {
    const {
      mapId = "locationMap",
      openButtonId = "setLocationOnMap",
      currentButtonId = "useCurrentLocation",
      statusId = "locationStatus",
      latId = "locationLatitude",
      lngId = "locationLongitude",
      addressId = "locationAddress",
      dialogId = "locationDialog",
      confirmButtonId = "confirmMapLocation",
      closeButtonId = "closeMapLocation"
    } = config || {};

    const status = byId(statusId);
    const latInput = byId(latId);
    const lngInput = byId(lngId);
    const addressInput = byId(addressId);
    const dialog = byId(dialogId);
    const openButton = byId(openButtonId);
    const currentButton = byId(currentButtonId);
    const confirmButton = byId(confirmButtonId);
    const closeButton = byId(closeButtonId);
    const mapElement = byId(mapId);

    if (!status || !latInput || !lngInput) {
      return null;
    }

    let map = null;
    let marker = null;
    let pendingLat = null;
    let pendingLng = null;

    function setStatus(text, type) {
      status.textContent = text || "";
      status.className = "location-status" + (type ? " " + type : "");
    }

    function updateStatus() {
      const lat = parseFloat(latInput.value);
      const lng = parseFloat(lngInput.value);

      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        setStatus(
          "Location saved: " +
          formatCoord(lat) +
          ", " +
          formatCoord(lng),
          "selected"
        );
      } else {
        setStatus(
          "No map location selected yet. A map pin is required before placing an order."
        );
      }
    }

    function ensureMap() {
      if (map || !mapElement || !window.L) {
        return map;
      }

      map = L.map(mapElement, {
        zoomControl: true
      }).setView([DEFAULT_LAT, DEFAULT_LNG], 13);

      L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors'
        }
      ).addTo(map);

      map.on("click", function (event) {
        pendingLat = event.latlng.lat;
        pendingLng = event.latlng.lng;
        showPendingMarker(pendingLat, pendingLng);
      });

      const existingLat = parseFloat(latInput.value);
      const existingLng = parseFloat(lngInput.value);

      if (Number.isFinite(existingLat) && Number.isFinite(existingLng)) {
        pendingLat = existingLat;
        pendingLng = existingLng;
        map.setView([existingLat, existingLng], 17);
        showPendingMarker(existingLat, existingLng);
      }

      return map;
    }

    function showPendingMarker(lat, lng) {
      if (!map) return;

      if (marker) {
        marker.setLatLng([lat, lng]);
      } else {
        marker = L.marker([lat, lng], {
          draggable: true
        }).addTo(map);

        marker.on("dragend", function () {
          const point = marker.getLatLng();
          pendingLat = point.lat;
          pendingLng = point.lng;
        });
      }

      map.setView([lat, lng], Math.max(map.getZoom(), 16));
    }

    function openMap() {
      if (!dialog) return;

      if (typeof dialog.showModal === "function") {
        dialog.showModal();
      } else {
        dialog.setAttribute("open", "");
      }

      const m = ensureMap();

      if (m) {
        setTimeout(function () {
          m.invalidateSize();
        }, 50);
      }
    }

    function closeMap() {
      if (!dialog) return;

      if (typeof dialog.close === "function") {
        dialog.close();
      } else {
        dialog.removeAttribute("open");
      }
    }

    function savePendingLocation() {
      if (!Number.isFinite(pendingLat) || !Number.isFinite(pendingLng)) {
        setStatus("Please tap the map or use your current location first.", "error");
        return false;
      }

      latInput.value = String(pendingLat);
      lngInput.value = String(pendingLng);

      /*
        Keep a machine-readable fallback even if no reverse
        geocoder is used. The written delivery address remains
        the customer's human-readable address.
      */
      if (addressInput && !addressInput.value.trim()) {
        addressInput.value =
          "Map pin: " +
          formatCoord(pendingLat) +
          ", " +
          formatCoord(pendingLng);
      }

      updateStatus();
      closeMap();
      return true;
    }

    function useCurrentLocation() {
      if (!navigator.geolocation) {
        setStatus(
          "Your browser does not support location services. Please set the location on the map.",
          "error"
        );
        return;
      }

      setStatus("Requesting your current location…");

      navigator.geolocation.getCurrentPosition(
        function (position) {
          pendingLat = position.coords.latitude;
          pendingLng = position.coords.longitude;

          const m = ensureMap();

          if (m) {
            m.setView([pendingLat, pendingLng], 17);
            showPendingMarker(pendingLat, pendingLng);
          }

          latInput.value = String(pendingLat);
          lngInput.value = String(pendingLng);

          if (addressInput && !addressInput.value.trim()) {
            addressInput.value =
              "Current location pin: " +
              formatCoord(pendingLat) +
              ", " +
              formatCoord(pendingLng);
          }

          updateStatus();
        },
        function (error) {
          let message =
            "Could not get your current location.";

          if (error && error.code === 1) {
            message =
              "Location permission was denied. Please allow location access or set the pin on the map.";
          } else if (error && error.code === 2) {
            message =
              "Your location could not be determined. Please set the pin on the map.";
          }

          setStatus(message, "error");
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 60000
        }
      );
    }

    if (openButton) {
      openButton.addEventListener("click", openMap);
    }

    if (currentButton) {
      currentButton.addEventListener("click", useCurrentLocation);
    }

    if (confirmButton) {
      confirmButton.addEventListener("click", savePendingLocation);
    }

    if (closeButton) {
      closeButton.addEventListener("click", closeMap);
    }

    if (dialog) {
      dialog.addEventListener("click", function (event) {
        if (event.target === dialog) {
          closeMap();
        }
      });
    }

    updateStatus();

    return {
      setLocation: function (lat, lng, label) {
        const latitude = Number(lat);
        const longitude = Number(lng);

        if (
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude)
        ) {
          return false;
        }

        latInput.value = String(latitude);
        lngInput.value = String(longitude);

        if (addressInput && label) {
          addressInput.value = String(label);
        }

        pendingLat = latitude;
        pendingLng = longitude;

        if (map) {
          map.setView([latitude, longitude], 17);
          showPendingMarker(latitude, longitude);
        }

        updateStatus();
        return true;
      },

      clear: function () {
        latInput.value = "";
        lngInput.value = "";

        if (addressInput) {
          addressInput.value = "";
        }

        pendingLat = null;
        pendingLng = null;

        if (marker) {
          marker.remove();
          marker = null;
        }

        updateStatus();
      },

      getLocation: function () {
        const latitude = parseFloat(latInput.value);
        const longitude = parseFloat(lngInput.value);

        return {
          latitude: Number.isFinite(latitude) ? latitude : null,
          longitude: Number.isFinite(longitude) ? longitude : null,
          location_address:
            addressInput?.value.trim() || null
        };
      },

      open: openMap,
      useCurrentLocation
    };
  }

  window.SuruLocationPicker = {
    init: createMapPicker
  };
})();
