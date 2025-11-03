// === SP 2016 ON-PREM – MODULAR EVENTS APP ===
(function (global, React, ReactDOM, $) {
  'use strict';

  // === API UTILITIES ===
  // (No changes needed to the `api` object; it appears functional)

  // === COMPONENTS ===
  const components = {
    ErrorBoundary({ children }) {
      const [error, setError] = React.useState(null);
      React.useEffect(() => {
        if (error) {
          const timestamp = new Date().toISOString();
          console.error(`[${timestamp}] [ErrorBoundary] Render error:`, error);
          const root = document.getElementById('root');
          if (root) {
            root.innerHTML = '';
            ReactDOM.render(
              React.createElement("div", { className: "alert alert-danger" }, `Render error: ${error.message || "Unknown error"}`),
              root
            );
            console.log(`[${timestamp}] [ErrorBoundary] Fallback UI rendered`);
          }
        }
      }, [error]);
      try {
        return error ? null : children;
      } catch (e) {
        setError(e);
        return null;
      }
    },

    EventCards({ events, myRegs, search, register, showUnreg, refreshMyRegs }) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [EventCards] Rendering ${events.length} events`, {
        search,
        events: events.map(e => ({ Id: e.Id, Title: e.Title }))
      });

      const validEvents = events.filter(e => {
        const isValid =
          e &&
          Number.isInteger(e.Id) &&
          typeof e.Title === 'string' &&
          e.Title &&
          e.StartTime &&
          e.EndTime &&
          !isNaN(new Date(e.StartTime).getTime()) &&
          !isNaN(new Date(e.EndTime).getTime());
        if (!isValid) console.warn(`[${timestamp}] [EventCards] Invalid event:`, e);
        return isValid;
      });
      console.log(`[${timestamp}] [EventCards] Valid events:`, validEvents.length);

      const filtered = validEvents.filter(e =>
        (e.Title || "").toLowerCase().includes(search.toLowerCase()) ||
        (e.Room || "").toLowerCase().includes(search.toLowerCase())
      );
      console.log(`[${timestamp}] [EventCards] Filtered events:`, filtered.length);

      if (!filtered.length) {
        return React.createElement("div", { className: "alert alert-info text-center" }, "No valid events found.");
      }

      const cards = filtered.map((ev, index) => {
        console.log(`[${timestamp}] [EventCards] Processing event ${index + 1}:`, { Id: ev.Id, Title: ev.Title });
        try {
          const myReg = myRegs.find(r => r.EventLookupId === ev.Id);
          const isFull = ev.MaxSeats && ev.regCount >= ev.MaxSeats;
          const endDate = new Date(ev.EndTime);
          const now = new Date();
          const isPast = endDate.getTime() < now.getTime();
          const canReg = ev.AllowRegistration && !isPast && !ev.IsOver;

          const panelCls = isFull || isPast || ev.IsOver
            ? "panel panel-default card-full" + (isPast ? " card-past" : "")
            : "panel panel-primary";

          let btn;
          if (!canReg) {
            btn = React.createElement("button", { className: "btn btn-default btn-sm disabled" }, isFull ? "Full" : "Closed");
          } else if (myReg) {
            const status = myReg.Status === 'Confirmed'
              ? React.createElement("button", { className: "btn btn-success btn-sm disabled" }, "Registered")
              : React.createElement("button", { className: "btn btn-warning btn-sm disabled" }, `Waitlist #${myReg.WaitlistPosition}`);
            btn = React.createElement("div", null, status,
              React.createElement("button", { className: "btn btn-danger btn-sm", onClick: () => showUnreg(ev.Id) }, "Cancel")
            );
          } else {
            btn = React.createElement("div", null,
              React.createElement("button", {
                className: "btn btn-success btn-sm",
                onClick: () => register(ev.Id)
              }, isFull ? "Join Waitlist" : "Register"),
              React.createElement("button", {
                className: "btn btn-info btn-sm",
                onClick: () => refreshMyRegs()
              }, "Refresh")
            );
          }

          return React.createElement("div", { key: `event-${ev.Id}`, className: "col-md-6 mb-3" },
            React.createElement("div", { className: panelCls },
              React.createElement("div", { className: "panel-heading" }, ev.Title || "Untitled Event"),
              React.createElement("div", { className: "panel-body" },
                React.createElement("p", null, "Time: ", ev.StartTime ? new Date(ev.StartTime).toLocaleString() : "TBD", " - ", ev.EndTime ? new Date(ev.EndTime).toLocaleString() : "TBD"),
                React.createElement("p", null, "Room: ", ev.Room || "TBD"),
                React.createElement("p", null, "Instructor: ", ev.Instructor || "TBD"),
                React.createElement("p", null, "Seats: ", ev.regCount, "/", ev.MaxSeats || "Unlimited")
              ),
              React.createElement("div", { className: "panel-footer text-right" }, btn)
            )
          );
        } catch (e) {
          console.error(`[${timestamp}] [EventCards] Failed to create card for Event ID ${ev.Id}:`, e);
          return null;
        }
      }).filter(card => card !== null);

      console.log(`[${timestamp}] [EventCards] Generated ${cards.length} cards`);
      return React.createElement("div", { className: "row event-row" }, cards);
    },

    UnregModal({ showModal, unregId, setShowModal, handleConfirmUnreg }) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [UnregModal] Rendering, showModal: ${showModal}, unregId: ${unregId}`);
      if (!showModal) return null;

      return [
        React.createElement("div", {
          key: "modal-backdrop",
          className: "modal-backdrop",
          style: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 1040 },
          onClick: () => setShowModal(false)
        }),
        React.createElement("div", {
          key: "modal",
          className: "modal",
          style: { display: "block", position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1050, overflow: "auto" }
        },
          React.createElement("div", { className: "modal-dialog", style: { margin: "10% auto", maxWidth: "500px" } },
            React.createElement("div", { className: "modal-content" },
              React.createElement("div", { className: "modal-header" },
                React.createElement("h4", { className: "modal-title" }, "Confirm Unregister"),
                React.createElement("button", { className: "close", onClick: () => setShowModal(false) }, "×")
              ),
              React.createElement("div", { className: "modal-body" },
                React.createElement("p", null, "Are you sure you want to unregister from this event?")
              ),
              React.createElement("div", { className: "modal-footer" },
                React.createElement("button", { className: "btn btn-default", onClick: () => setShowModal(false) }, "Close"),
                React.createElement("button", { className: "btn btn-danger", onClick: handleConfirmUnreg }, "Yes, Cancel")
              )
            )
          )
        )
      ];
    },

    AdminLinks() {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [AdminLinks] Rendering...`);
      return React.createElement("div", null,
        React.createElement("a", { href: "AdminDashboard.aspx", className: "btn btn-warning btn-block mb-2" }, "Admin Dashboard"),
        React.createElement("a", { href: "Survey.aspx", className: "btn btn-info btn-block" }, "Design Survey")
      );
    }
  };

  // === MAIN APP ===
  const app = {
    validateDependencies() {
      const timestamp = new Date().toISOString();
      const checks = {
        jQuery: typeof $ === "function" ? "Loaded" : "Not loaded",
        React: typeof React !== "undefined" ? `Loaded ${React.version}` : "Not loaded",
        ReactDOM: typeof ReactDOM !== "undefined" ? "Loaded" : "Not loaded",
        render: typeof ReactDOM.render === "function" ? "Available" : "Not available"
      };
      console.log(`[${timestamp}] [validateDependencies] Check:`, checks);
      if (Object.values(checks).includes("Not loaded") || checks.render !== "Available") {
        throw new Error("Dependencies missing: " + JSON.stringify(checks));
      }
      if (React.version !== "17.0.2") {
        console.warn(`[${timestamp}] [validateDependencies] Unexpected React version: ${React.version}`);
      }
    },

    init() {
      $(document).ready(async () => {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [App Init] DOM Ready`);

        try {
          this.validateDependencies();

          const root = document.getElementById('root');
          if (!root) {
            throw new Error("Root element not found. Check EventsDashboard.aspx for <div id='root'></div>");
          }
          root.innerHTML = '';
          root.style.display = 'block';
          root.style.visibility = 'visible';
          console.log(`[${timestamp}] [App Init] Root initialized:`, {
            display: root.style.display,
            visibility: root.style.visibility,
            computed: window.getComputedStyle(root).display
          });

          const ctx = await api.getContext();
          if (ctx.error) {
            throw new Error(ctx.message);
          }
          console.log(`[${timestamp}] [App Init] Context:`, { site: ctx.site, user: ctx.userEmail });

          const App = () => {
            const [events, setEvents] = React.useState([]);
            const [myRegs, setMyRegs] = React.useState([]);
            const [isAdmin, setIsAdmin] = React.useState(false);
            const [search, setSearch] = React.useState('');
            const [loading, setLoading] = React.useState(true);
            const [unregId, setUnregId] = React.useState(null);
            const [showModal, setShowModal] = React.useState(false);
            const [error, setError] = React.useState(null);

            const siteRef = React.useRef(ctx.site);
            const userEmailRef = React.useRef(ctx.userEmail);
            const digestRef = React.useRef(ctx.digest);

            React.useEffect(() => {
              const timestamp = new Date().toISOString();
              console.log(`[${timestamp}] [useEffect] Initializing...`);

              const timeout = setTimeout(() => {
                if (loading) {
                  console.error(`[${timestamp}] [useEffect] Loading timeout`);
                  setError("Loading timeout. Please try again.");
                  setLoading(false);
                }
              }, 30000);

              const loadData = async () => {
                try {
                  const isAdmin = await api.checkAdmin(siteRef.current);
                  setIsAdmin(isAdmin);
                  if (isAdmin) {
                    const adminRoot = document.getElementById("adminLinks");
                    if (adminRoot) {
                      ReactDOM.render(React.createElement(components.AdminLinks), adminRoot);
                      console.log(`[${timestamp}] [useEffect] Admin links rendered`);
                    }
                  }

                  const eventsData = await api.loadEvents(siteRef.current, digestRef.current);
                  if (eventsData.error) throw new Error(eventsData.message);
                  const regsData = await api.loadMyRegs(siteRef.current, userEmailRef.current);
                  if (regsData.error) throw new Error(regsData.message);

                  setEvents([...eventsData]);
                  setMyRegs([...regsData]);
                  setLoading(false);
                  console.log(`[${timestamp}] [useEffect] Data loaded:`, {
                    events: eventsData.length,
                    regs: regsData.length
                  });
                } catch (e) {
                  console.error(`[${timestamp}] [useEffect] Data load failed:`, e);
                  setError(`Failed to load data: ${e.message}`);
                  setLoading(false);
                }
                clearTimeout(timeout);
              };

              loadData();
              $('#searchBox').on('input', handleSearch);
              return () => $('#searchBox').off('input', handleSearch);
            }, []);

            const handleSearch = (e) => {
              const timestamp = new Date().toISOString();
              console.log(`[${timestamp}] [handleSearch] Search:`, e.target.value);
              setSearch(e.target.value);
            };

            const register = async (id) => {
              const timestamp = new Date().toISOString();
              console.log(`[${timestamp}] [register] Event ID: ${id}`);
              try {
                setLoading(true);
                $("#loading").show();

                const ev = events.find(e => e.Id === id);
                if (!ev) {
                  alert("Event not found.");
                  setLoading(false);
                  return;
                }
                if (!ev.AllowRegistration) {
                  alert("Registration closed.");
                  setLoading(false);
                  return;
                }
                const endDate = new Date(ev.EndTime);
                if (endDate.getTime() < Date.now()) {
                  alert("This event has ended.");
                  setLoading(false);
                  return;
                }
                const existing = await api.checkExistingRegistration(siteRef.current, id, userEmailRef.current);
                if (existing) {
                  alert(`You are already ${existing.Status === 'Confirmed' ? 'registered' : `waitlisted (#${existing.WaitlistPosition})`}`);
                  setLoading(false);
                  return;
                }
                digestRef.current = (await api.refreshDigest(siteRef.current))?.digest || digestRef.current;
                if (!digestRef.current) {
                  alert("Failed to refresh form digest.");
                  setLoading(false);
                  return;
                }
                const count = await api.getRegCount(siteRef.current, id);
                const full = ev.MaxSeats && count >= ev.MaxSeats;
                if (!full) {
                  const result = await api.createReg(siteRef.current, digestRef.current, id, userEmailRef.current, 'Confirmed', null, ev.Title);
                  alert(result.message);
                } else {
                  const pos = await api.getNextWaitlistPosition(siteRef.current, id);
                  if (confirm(`Event full. Join waitlist #${pos}?`)) {
                    const result = await api.createReg(siteRef.current, digestRef.current, id, userEmailRef.current, 'Waitlisted', pos, ev.Title);
                    alert(result.message);
                  } else {
                    alert("Waitlist registration cancelled.");
                  }
                }
                const [eventsData, regsData] = await Promise.all([
                  api.loadEvents(siteRef.current, digestRef.current),
                  api.loadMyRegs(siteRef.current, userEmailRef.current)
                ]);
                setEvents([...(eventsData.error ? [] : eventsData)]);
                setMyRegs([...(regsData.error ? [] : regsData)]);
                setLoading(false);
              } catch (e) {
                console.error(`[${timestamp}] [register] Error:`, e);
                alert("Failed to register. Check console.");
                setLoading(false);
              }
            };

            const showUnreg = (id) => {
              const timestamp = new Date().toISOString();
              console.log(`[${timestamp}] [showUnreg] Event ID: ${id}`);
              if (!Number.isInteger(id) || id <= 0) {
                alert("Invalid event ID.");
                return;
              }
              setUnregId(id);
              setShowModal(true);
            };

            const refreshMyRegs = async () => {
              const timestamp = new Date().toISOString();
              console.log(`[${timestamp}] [refreshMyRegs] Starting...`);
              setLoading(true);
              const regsData = await api.loadMyRegs(siteRef.current, userEmailRef.current);
              setMyRegs([...(regsData.error ? [] : regsData)]);
              setLoading(false);
            };

            const handleConfirmUnreg = async () => {
              const timestamp = new Date().toISOString();
              console.log(`[${timestamp}] [handleConfirmUnreg] Unreg ID: ${unregId}`);
              if (!Number.isInteger(unregId) || unregId <= 0) {
                alert("Invalid event ID.");
                setShowModal(false);
                return;
              }
              try {
                setLoading(true);
                setShowModal(false);
                $("#loading").show();
                digestRef.current = (await api.refreshDigest(siteRef.current))?.digest || digestRef.current;
                const result = await api.unregister(siteRef.current, digestRef.current, unregId, userEmailRef.current);
                alert(result.message);
                const [eventsData, regsData] = await Promise.all([
                  api.loadEvents(siteRef.current, digestRef.current),
                  api.loadMyRegs(siteRef.current, userEmailRef.current)
                ]);
                setEvents([...(eventsData.error ? [] : eventsData)]);
                setMyRegs([...(regsData.error ? [] : regsData)]);
                setUnregId(null);
                setLoading(false);
              } catch (e) {
                console.error(`[${timestamp}] [handleConfirmUnreg] Error:`, e);
                alert("Failed to unregister. Check console.");
                setLoading(false);
                setShowModal(false);
              }
            };

            // Render directly in the component
            if (error) {
              return React.createElement("div", { className: "alert alert-danger" }, error);
            }

            if (loading) {
              return React.createElement("div", { className: "alert alert-info text-center" }, "Loading events...");
            }

            return React.createElement(components.ErrorBoundary, null,
              React.createElement("div", { className: "event-container" },
                React.createElement(components.EventCards, {
                  events,
                  myRegs,
                  search,
                  register,
                  showUnreg,
                  refreshMyRegs
                }),
                React.createElement(components.UnregModal, {
                  showModal,
                  unregId,
                  setShowModal,
                  handleConfirmUnreg
                })
              )
            );
          };

          ReactDOM.render(React.createElement(App), root);
          $("#loading").show();
          console.log(`[${timestamp}] [App Init] App rendered`);
        } catch (e) {
          console.error(`[${timestamp}] [App Init] Failed:`, e);
          const root = document.getElementById('root');
          if (root) {
            root.innerHTML = '';
            ReactDOM.render(
              React.createElement("div", { className: "alert alert-danger" }, `Failed to initialize app: ${e.message}`),
              root
            );
            console.log(`[${timestamp}] [App Init] Error fallback rendered`);
          }
        }
      });
    }
  };

  // Start App
  app.init();
})(window, window.React, window.ReactDOM, window.jQuery);