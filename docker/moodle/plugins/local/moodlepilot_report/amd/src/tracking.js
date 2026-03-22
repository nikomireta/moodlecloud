define(["core/ajax"], function(Ajax) {
    var heartbeatHandle = null;
    var lastInteractionAt = Date.now();
    var mediaActive = false;
    var listenersInstalled = false;

    function nowSeconds() {
        return Math.floor(Date.now() / 1000);
    }

    function recordInteraction() {
        lastInteractionAt = Date.now();
    }

    function userIsActive(inactivitySeconds) {
        return mediaActive || (Date.now() - lastInteractionAt) <= (inactivitySeconds * 1000);
    }

    function sendHeartbeat(config, visitDelta, activeSeconds) {
        return Ajax.call([{
            methodname: "local_moodlepilot_report_track_heartbeat",
            args: {
                page_type: config.pageType,
                page_instance: config.pageInstance,
                course_id: config.courseId,
                page_label: config.pageLabel,
                visit_delta: visitDelta,
                active_seconds: activeSeconds,
                media_active: mediaActive,
                observed_at: nowSeconds(),
            },
        }])[0];
    }

    function installInteractionListeners() {
        if (listenersInstalled) {
            return;
        }

        ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "visibilitychange"].forEach(function(eventName) {
            document.addEventListener(eventName, function() {
                if (eventName !== "visibilitychange" || !document.hidden) {
                    recordInteraction();
                }
            }, {passive: true});
        });

        ["play", "playing"].forEach(function(eventName) {
            document.addEventListener(eventName, function(e) {
                if (e && e.target && typeof e.target.matches === "function" && e.target.matches("video, audio")) {
                    mediaActive = true;
                    recordInteraction();
                }
            }, true);
        });

        ["pause", "ended"].forEach(function(eventName) {
            document.addEventListener(eventName, function(e) {
                if (e && e.target && typeof e.target.matches === "function" && e.target.matches("video, audio")) {
                    mediaActive = false;
                }
            }, true);
        });

        listenersInstalled = true;
    }

    function startHeartbeat(config) {
        if (heartbeatHandle) {
            window.clearInterval(heartbeatHandle);
        }

        sendHeartbeat(config, 1, 0).catch(function() {
            return null;
        });

        heartbeatHandle = window.setInterval(function() {
            if (document.hidden) {
                return;
            }
            var activeSeconds = userIsActive(config.inactivitySeconds) ? config.intervalSeconds : 0;
            sendHeartbeat(config, 0, activeSeconds).catch(function() {
                return null;
            });
        }, config.intervalSeconds * 1000);
    }

    function init(rawConfig) {
        if (!rawConfig || typeof window === "undefined" || typeof document === "undefined") {
            return;
        }

        var config = {
            pageType: rawConfig.pageType || "site",
            pageInstance: Number(rawConfig.pageInstance || 0),
            courseId: Number(rawConfig.courseId || 0),
            pageLabel: rawConfig.pageLabel || "site",
            intervalSeconds: Math.max(10, Number(rawConfig.intervalSeconds || 15)),
            inactivitySeconds: Math.max(30, Number(rawConfig.inactivitySeconds || 60)),
        };

        installInteractionListeners();
        startHeartbeat(config);
    }

    return {
        init: init,
    };
});
