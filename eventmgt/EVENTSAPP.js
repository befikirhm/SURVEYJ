// === SP 2016 ON-PREM – UPGRADED TO REACT 17 ===
(function () {
  'use strict';

  // === ERROR HANDLER ===
  function handleError(step, error, userMsg = "An error occurred.") {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [ERROR] ${step}:`, {
      message: error.message || "No message",
      status: error.status || "N/A",
      statusText: error.statusText || "N/A",
      response: error.responseJSON || error.responseText || "No response",
      stack: error.stack || "No stack"
    });
    const root = document.getElementById('root');
    if (root) {
      root.innerHTML = '';
      try {
        const errorElement = React.createElement("div", { className: "alert alert-danger" }, `${userMsg}\n\nCheck F12 Console for details.`);
        const reactRoot = ReactDOM.createRoot(root);
        reactRoot.render(errorElement);
        console.log(`[${timestamp}] [handleError] Error rendered to #root`);
      } catch (e) {
        console.error(`[${timestamp}] [handleError] Failed to render error:`, e);
        alert(`${userMsg}\nError: Failed to render to DOM. Check console.`);
      }
    } else {
      console.error(`[${timestamp}] [handleError] #root element not found`);
      alert(`${userMsg}\nError: #root element not found in DOM.`);
    }
  }

  // === REFRESH DIGEST ===
  async function refreshDigest(site) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [refreshDigest] Fetching new digest...`);
    try {
      const resp = await $.ajax({
        url: site + "/_api/contextinfo",
        method: "POST",
        headers: { Accept: "application/json; odata=verbose" },
        timeout: 5000
      });
      const digest = resp.d.GetContextWebInformation.FormDigestValue;
      console.log(`[${timestamp}] [refreshDigest] New digest:`, digest.substring(0, 20) + "...");
      return digest;
    } catch (e) {
      console.error(`[${timestamp}] [refreshDigest] Failed to refresh digest:`, e);
      return null;
    }
  }

  // === GET CONTEXT ===
  async function getContext() {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [getContext] Starting context load...`);

    return new Promise(async (resolve) => {
      let site = '';
      let userEmail = '';
      let digest = '';

      try {
        console.log(`[${timestamp}] [getContext] Fetching site URL...`);
        if (typeof _spPageContextInfo !== 'undefined' && _spPageContextInfo?.webAbsoluteUrl) {
          site = _spPageContextInfo.webAbsoluteUrl.replace(/\/$/, '');
        } else {
          const path = window.location.pathname;
          const match = path.match(/\/sites\/[^\/]+|\/[^\/]+/);
          site = window.location.origin + (match ? match[0] : '');
        }
        console.log(`[${timestamp}] [getContext] Site URL:`, site);
      } catch (e) {
        handleError("Site URL", e, "Failed to load site URL.");
        return resolve(null);
      }

      try {
        console.log(`[${timestamp}] [getContext] Fetching user email via REST...`);
        const userResp = await $.ajax({
          url: site + "/_api/web/currentuser",
          headers: { Accept: "application/json; odata=verbose" },
          timeout: 10000
        });
        userEmail = userResp.d.Email || userResp.d.LoginName;
        console.log(`[${timestamp}] [getContext] User Email:`, userEmail);
      } catch (e) {
        console.warn(`[${timestamp}] [getContext] User email REST failed, using fallback:`, e);
        userEmail = _spPageContextInfo?.userLoginName || 'unknown';
        console.log(`[${timestamp}] [getContext] Fallback User Email:`, userEmail);
      }

      try {
        console.log(`[${timestamp}] [getContext] Fetching digest...`);
        digest = $("#FormDigest1").val() || $("#__REQUESTDIGEST").val() || '';
        if (!digest) {
          console.warn(`[${timestamp}] [getContext] FormDigest1 not found, refreshing digest...`);
          digest = await refreshDigest(site);
        }
        console.log(`[${timestamp}] [getContext] Digest loaded:`, digest.substring(0, 20) + "...");
      } catch (e) {
        handleError("Digest", e, "Failed to load form digest.");
        return resolve(null);
      }

      if (!site || !userEmail || !digest) {
        handleError("Context", new Error("Incomplete context"), "Missing site, user, or digest.");
        return resolve(null);
      }

      console.log(`[${timestamp}] [getContext] Context loaded successfully`);
      resolve({ site, userEmail, digest });
    });
  }

  // === MAIN APP ===
  $(document).ready(async function () {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [App Init] DOM Ready. Initializing...`);
    console.log(`[${timestamp}] [App Init] React version:`, React.version);

    let appInstance = null;
    let reactRoot = null;

    try {
      const ctx = await getContext();
      if (!ctx) {
        console.error(`[${timestamp}] [App Init] Context load failed`);
        return;
      }

      console.log(`[${timestamp}] [App Init] FULL CONTEXT READY:`, { site: ctx.site, user: ctx.userEmail });

      const App = () => {
        // State Hooks
        const [events, setEvents] = React.useState([]);
        const [myRegs, setMyRegs] = React.useState([]);
        const [isAdmin, setIsAdmin] = React.useState(false);
        const [search, setSearch] = React.useState('');
        const [loading, setLoading] = React.useState(true);
        const [unregId, setUnregId] = React.useState(null);
        const [showModal, setShowModal] = React.useState(false);

        // Context Refs
        const siteRef = React.useRef(ctx.site);
        const userEmailRef = React.useRef(ctx.userEmail);
        const digestRef = React.useRef(ctx.digest);

        // Error Boundary Component
        const ErrorBoundary = ({ children }) => {
          const [error, setError] = React.useState(null);
          React.useEffect(() => {
            if (error) {
              const timestamp = new Date().toISOString();
              console.error(`[${timestamp}] [ErrorBoundary] Render error:`, error);
              handleError("Render Component", error, "Failed to render component. Check console for details.");
            }
          }, [error]);
          try {
            return error ? React.createElement("div", { className: "alert alert-danger" }, "Render error. Check console.") : children;
          } catch (e) {
            setError(e);
            return null;
          }
        };

        // Event Cards Component
        const EventCards = ({ events, myRegs, search, register, showUnreg, refreshMyRegs }) => {
          const timestamp = new Date().toISOString();
          console.log(`[${timestamp}] [EventCards] START Rendering ${events.length} events`, { search, events });

          // Validate events
          const validEvents = events.filter(e => {
            const isValid = e &&
              Number.isInteger(e.Id) &&
              typeof e.Title === 'string' &&
              e.Title &&
              e.StartTime &&
              e.EndTime &&
              !isNaN(new Date(e.StartTime).getTime()) &&
              !isNaN(new Date(e.EndTime).getTime());
            if (!isValid) {
              console.warn(`[${timestamp}] [EventCards] Invalid event data:`, e);
            }
            return isValid;
          });
          console.log(`[${timestamp}] [EventCards] Valid events:`, validEvents.length, validEvents);

          const filtered = validEvents.filter(e =>
            (e.Title || "").toLowerCase().includes(search) ||
            (e.Room || "").toLowerCase().includes(search)
          );
          console.log(`[${timestamp}] [EventCards] Filtered events:`, filtered.length, filtered);

          const cards = filtered.length ? filtered.map((ev, index) => {
            console.log(`[${timestamp}] [EventCards] Processing event ${index + 1}/${filtered.length}:`, ev);
            try {
              const myReg = myRegs.find(r => r.EventLookupId === ev.Id);
              const isFull = ev.MaxSeats && ev.regCount >= ev.MaxSeats;
              const endDate = new Date(ev.EndTime);
              const now = new Date();
              const isPast = endDate.getTime() < now.getTime();
              const canReg = ev.AllowRegistration && !isPast && !ev.IsOver;

              console.log(`[${timestamp}] [EventCards] Event ID ${ev.Id}:`, {
                title: ev.Title,
                isFull,
                isPast,
                canReg,
                registered: !!myReg,
                status: myReg?.Status
              });

              const panelCls = isFull || isPast || ev.IsOver ? "panel panel-default card-full" + (isPast ? " card-past" : "") : "panel panel-primary";

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
                  React.createElement("button", { className: "btn btn-success btn-sm", onClick: () => register(ev.Id) }, isFull ? "Join Waitlist" : "Register"),
                  React.createElement("button", { className: "btn btn-info btn-sm", onClick: () => refreshMyRegs() }, "Refresh")
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
          }).filter(card => card !== null) : [React.createElement("div", { key: "no-events", className: "alert alert-info text-center" }, "No valid events found. Please check Events list or permissions.")];

          console.log(`[${timestamp}] [EventCards] Generated ${cards.length} cards`);

          try {
            return React.createElement("div", { className: "row event-row" }, cards);
          } catch (e) {
            console.error(`[${timestamp}] [EventCards] Failed to render cards:`, e);
            return React.createElement("div", { className: "alert alert-danger" }, "Failed to render event cards. Check console.");
          }
        };

        // Modal Component
        const UnregModal = () => {
          const timestamp = new Date().toISOString();
          console.log(`[${timestamp}] [UnregModal] Rendering modal, showModal:`, showModal, "unregId:", unregId);
          return showModal ? [
            React.createElement("div", {
              key: "modal-backdrop",
              className: "modal-backdrop",
              style: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 1040 },
              onClick: () => {
                console.log(`[${timestamp}] [modal] Backdrop clicked`);
                setShowModal(false);
              }
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
                    React.createElement("button", {
                      className: "close",
                      onClick: () => {
                        console.log(`[${timestamp}] [modal] Close clicked`);
                        setShowModal(false);
                      }
                    }, "×")
                  ),
                  React.createElement("div", { className: "modal-body" },
                    React.createElement("p", null, "Are you sure you want to unregister from this event?")
                  ),
                  React.createElement("div", { className: "modal-footer" },
                    React.createElement("button", {
                      className: "btn btn-default",
                      onClick: () => {
                        console.log(`[${timestamp}] [modal] Close button clicked`);
                        setShowModal(false);
                      }
                    }, "Close"),
                    React.createElement("button", {
                      className: "btn btn-danger",
                      onClick: () => {
                        console.log(`[${timestamp}] [modal] Yes, Cancel clicked`);
                        handleConfirmUnreg();
                      }
                    }, "Yes, Cancel")
                  )
                )
              )
            )
          ] : null;
        };

        // Force render on state changes
        React.useEffect(() => {
          const timestamp = new Date().toISOString();
          console.log(`[${timestamp}] [useEffect] State changed:`, { loading, events: events.length, myRegs: myRegs.length });
          const timer = setTimeout(() => {
            console.log(`[${timestamp}] [useEffect] Forcing render after 300ms delay`);
            renderApp();
          }, 300);
          return () => clearTimeout(timer);
        }, [loading, events, myRegs]);

        // useEffect for componentDidMount
        React.useEffect(() => {
          const timestamp = new Date().toISOString();
          console.log(`[${timestamp}] [useEffect] Initializing component...`);

          const root = document.getElementById('root');
          if (!root) {
            console.error(`[${timestamp}] [useEffect] #root element not found in DOM`);
            alert("Error: #root element not found in DOM. Check EventsDashboard.aspx.");
            setLoading(false);
            return;
          }

          appInstance = {
            unregister,
            refreshMyRegs,
            showUnreg,
            register
          };
          window.appInstance = appInstance;

          $('#searchBox').on('input', handleSearch);

          const timeout = setTimeout(() => {
            if (loading) {
              console.error(`[${timestamp}] [useEffect] Loading timeout after 30s`);
              setLoading(false);
              handleError("Load Timeout", new Error("Loading took too long"), "Loading timed out. Please refresh the page.");
            }
          }, 30000);

          checkAdmin(() => {
            console.log(`[${timestamp}] [useEffect] Admin check done. Loading events and registrations...`);
            Promise.all([loadEvents(), loadMyRegs()])
              .then(([loadedEvents, loadedRegs]) => {
                console.log(`[${timestamp}] [useEffect] All data loaded, clearing timeout`, { events: loadedEvents.length, regs: loadedRegs.length });
                clearTimeout(timeout);
                setEvents([...loadedEvents]);
                setMyRegs([...loadedRegs]);
                setLoading(false);
                console.log(`[${timestamp}] [useEffect] State updated`, { events: loadedEvents.length, regs: loadedRegs.length, loading: false });
              })
              .catch(err => {
                console.error(`[${timestamp}] [useEffect] Error loading data:`, err);
                clearTimeout(timeout);
                setLoading(false);
                handleError("Load Data", err, "Failed to load events or registrations.");
              });
          });

          return () => {
            $('#searchBox').off('input', handleSearch);
            clearTimeout(timeout);
          };
        }, []);

        const handleSearch = (e) => {
          const timestamp = new Date().toISOString();
          console.log(`[${timestamp}] [handleSearch] Search updated:`, e.target.value);
          setSearch(e.target.value.toLowerCase());
        };

        const checkAdmin = (cb) => {
          const timestamp = new Date().toISOString();
          console.log(`[${timestamp}] [checkAdmin] Checking if user is in 'Event Managers'...`);
          $.ajax({
            url: siteRef.current + "/_api/web/currentuser/groups?$filter=Title eq 'Event Managers'",
            headers: { Accept: "application/json; odata=verbose" },
            timeout: 5000,
            success: d => {
              try {
                const isAdmin = d.d?.results?.length > 0;
                console.log(`[${timestamp}] [checkAdmin] User is${isAdmin ? '' : ' not'} admin`);
                setIsAdmin(isAdmin);
                if (isAdmin) renderAdminLinks();
                cb();
              } catch (e) {
                console.warn(`[${timestamp}] [checkAdmin] Error parsing admin response:`, e);
                cb();
              }
            },
            error: xhr => {
              console.warn(`[${timestamp}] [checkAdmin] Failed to check admin status:`, xhr);
              cb();
            }
          });
        };

        const renderAdminLinks = () => {
          const timestamp = new Date().toISOString();
          console.log(`[${timestamp}] [renderAdminLinks] Rendering admin links...`);
          try {
            const adminRoot = document.getElementById("adminLinks");
            if (!adminRoot) {
              console.error(`[${timestamp}] [renderAdminLinks] #adminLinks element not found`);
              return;
            }
            const links = React.createElement("div", null,
              React.createElement("a", { href: "AdminDashboard.aspx", className: "btn btn-warning btn-block mb-2" }, "Admin Dashboard"),
              React.createElement("a", { href: "Survey.aspx", className: "btn btn-info btn-block" }, "Design Survey")
            );
            const reactAdminRoot = ReactDOM.createRoot(adminRoot);
            reactAdminRoot.render(links);
            console.log(`[${timestamp}] [renderAdminLinks] Admin links rendered`);
          } catch (e) {
            handleError("Render Admin Links", e, "Failed to render admin links.");
          }
        };

        const loadEvents = () => {
          const timestamp = new Date().toISOString();
          console.log(`[${timestamp}] [loadEvents] STARTED`);

          return new Promise((resolve, reject) => {
            const q = "?$select=Id,Title,StartDate,EndDate,Location,Instructor,MaxSeats,AllowRegistration,IsOver,Attachments";
            const url = siteRef.current + "/_api/web/lists/getbytitle('Events')/items" + q;

            $.ajax({
              url,
              headers: { Accept: "application/json; odata=verbose" },
              timeout: 15000,
              success: d => {
                console.log(`[${timestamp}] [loadEvents] Raw response:`, d);
                try {
                  let evs = (d.d?.results || []).map((ev, index) => {
                    const startDate = ev.StartDate ? new Date(ev.StartDate) : null;
                    const endDate = ev.EndDate ? new Date(ev.EndDate) : null;
                    console.log(`[${timestamp}] [loadEvents] Processing event ${index + 1}:`, ev.Id, ev.Title, {
                      StartDate: ev.StartDate,
                      EndDate: ev.EndDate,
                      AllowRegistration: ev.AllowRegistration,
                      ParsedStart: startDate?.toISOString() || 'Invalid',
                      ParsedEnd: endDate?.toISOString() || 'Invalid'
                    });
                    if (!ev.Id || !ev.Title || !startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                      console.warn(`[${timestamp}] [loadEvents] Skipping invalid event:`, ev);
                      return null;
                    }
                    return {
                      Id: ev.Id,
                      Title: ev.Title,
                      StartTime: startDate.toISOString(),
                      EndTime: endDate.toISOString(),
                      Room: ev.Location || "TBD",
                      Instructor: ev.Instructor || "TBD",
                      MaxSeats: ev.MaxSeats || null,
                      AllowRegistration: !!ev.AllowRegistration,
                      IsOver: !!ev.IsOver,
                      Attachments: ev.Attachments || false,
                      regCount: 0
                    };
                  }).filter(ev => ev !== null).sort((a, b) => new Date(a.StartTime) - new Date(b.EndTime));

                  console.log(`[${timestamp}] [loadEvents] Events processed:`, evs.length, evs);

                  if (evs.length === 0) {
                    console.log(`[${timestamp}] [loadEvents] No valid events found in response`);
                    resolve([]);
                    return;
                  }

                  Promise.all(evs.map(e => getRegCount(e.Id).then(c => ({ ...e, regCount: c }))))
                    .then(processed => {
                      console.log(`[${timestamp}] [loadEvents] Events with reg counts:`, processed.length, processed);
                      resolve(processed);
                    })
                    .catch(err => {
                      console.warn(`[${timestamp}] [loadEvents] Error processing reg counts:`, err);
                      resolve(evs.map(e => ({ ...e, regCount: 0 })));
                    });
                } catch (err) {
                  console.error(`[${timestamp}] [loadEvents] Error parsing events:`, err);
                  handleError("Parse Events", err, "Failed to parse events data. Check list columns or response format.");
                  resolve([]);
                }
              },
              error: xhr => {
                console.error(`[${timestamp}] [loadEvents] Failed to load events:`, {
                  status: xhr.status,
                  statusText: xhr.statusText,
                  response: xhr.responseJSON || xhr.responseText
                });
                let msg = "Failed to load events. Please check list settings or permissions.";
                if (xhr.status === 404) msg = "List 'Events' not found. Verify list name.";
                if (xhr.status === 403) msg = "Access denied to Events list. Contact your administrator.";
                if (xhr.status === 400) msg = "Invalid query. Check column names in Events list.";
                handleError("Load Events", xhr, msg);
                resolve([]);
              }
            });
          });
        };

        const loadMyRegs = () => {
          const timestamp = new Date().toISOString();
          console.log(`[${timestamp}] [loadMyRegs] Loading user registrations for:`, userEmailRef.current);

          return new Promise((resolve, reject) => {
            if (!userEmailRef.current || userEmailRef.current === 'unknown') {
              console.error(`[${timestamp}] [loadMyRegs] Invalid userEmail:`, userEmailRef.current);
              handleError("Load My Registrations", new Error("Invalid user email"), "Cannot load registrations due to invalid user email.");
              resolve([]);
              return;
            }

            const query = `${siteRef.current}/_api/web/lists/getbytitle('Registrations')/items` +
                          `?$filter=UserEmail eq '${userEmailRef.current.replace(/'/g, "''")}'` +
                          `&$select=Id,EventLookupId,Status,WaitlistPosition,Title,RegistrationDate,EventLookupId/Id` +
                          `&$expand=EventLookupId`;
            console.log(`[${timestamp}] [loadMyRegs] Query URL:`, query);

            $.ajax({
              url: query,
              headers: { Accept: "application/json; odata=verbose" },
              timeout: 20000,
              success: d => {
                console.log(`[${timestamp}] [loadMyRegs] Raw response:`, d);
                try {
                  const registrations = (d.d?.results || []).map(r => {
                    const eventLookupId = r.EventLookupId?.Id || r.EventLookupId;
                    if (!eventLookupId) {
                      console.warn(`[${timestamp}] [loadMyRegs] Missing EventLookupId for registration:`, r);
                    }
                    return {
                      Id: r.Id,
                      EventLookupId: eventLookupId,
                      Title: r.Title || "Unknown",
                      Status: r.Status,
                      WaitlistPosition: r.WaitlistPosition,
                      RegistrationDate: r.RegistrationDate
                    };
                  });
                  console.log(`[${timestamp}] [loadMyRegs] My registrations loaded:`, registrations.length, registrations);
                  resolve(registrations);
                } catch (e) {
                  console.error(`[${timestamp}] [loadMyRegs] Error parsing registrations:`, e);
                  handleError("Parse Registrations", e, "Failed to parse user registrations.");
                  resolve([]);
                }
              },
              error: (xhr, status, error) => {
                console.error(`[${timestamp}] [loadMyRegs] Failed to load registrations:`, {
                  status: xhr.status,
                  statusText: xhr.statusText,
                  response: xhr.responseJSON || xhr.responseText,
                  error
                });
                let userMsg = "Failed to load your registrations. Please check permissions or list settings.";
                if (xhr.status === 403) userMsg = "Access denied to Registrations list. Contact your administrator.";
                if (xhr.status === 404) userMsg = "Registrations list not found. Verify list name.";
                if (xhr.status === 400) userMsg = "Invalid query. Check UserEmail or EventLookupId configuration.";
                handleError("Load My Registrations", xhr, userMsg);
                resolve([]);
              }
            });
          });
        };

        const refreshMyRegs = () => {
          const timestamp = new Date().toISOString();
          console.log(`[${timestamp}] [refreshMyRegs] Manually refreshing registrations...`);
          setLoading(true);
          loadMyRegs().then(regs => {
            setMyRegs([...regs]);
            setLoading(false);
          }).catch(err => {
            console.error(`[${timestamp}] [refreshMyRegs] Error refreshing registrations:`, err);
            setLoading(false);
          });
        };

        const getRegCount = (id) => {
          const timestamp = new Date().toISOString();
          console.log(`[${timestamp}] [getRegCount] Getting registration count for Event ID:`, id);

          return new Promise(r => {
            $.ajax({
              url: siteRef.current + "/_api/web/lists/getbytitle('Registrations')/items?$filter=EventLookupId eq " + id + " and Status eq 'Confirmed'&$select=Id",
              headers: { Accept: "application/json; odata=verbose" },
              timeout: 10000,
              success: d => {
                console.log(`[${timestamp}] [getRegCount] Count for Event ID ${id}:`, d.d?.results?.length || 0);
                r(d.d?.results?.length || 0);
              },
              error: xhr => {
                console.warn(`[${timestamp}] [getRegCount] Failed for Event ID ${id}:`, xhr);
                r(0);
              }
            });
          });
        };

        const checkExistingRegistration = (id) => {
          const timestamp = new Date().toISOString();
          console.log(`[${timestamp}] [checkExistingRegistration] Checking registration for Event ID:`, id, "User:", userEmailRef.current);

          return new Promise(resolve => {
            if (!userEmailRef.current || userEmailRef.current === 'unknown') {
              console.warn(`[${timestamp}] [checkExistingRegistration] Invalid userEmail:`, userEmailRef.current);
              resolve(null);
              return;
            }

            const query = `${siteRef.current}/_api/web/lists/getbytitle('Registrations')/items` +
                          `?$filter=EventLookupId eq ${id} and UserEmail eq '${userEmailRef.current.replace(/'/g, "''")}'` +
                          `&$select=Id,Status,WaitlistPosition,Title,EventLookupId/Id&$expand=EventLookupId`;
            console.log(`[${timestamp}] [checkExistingRegistration] Query URL:`, query);

            $.ajax({
              url: query,
              headers: { Accept: "application/json; odata=verbose" },
              timeout: 5000,
              success: d => {
                const reg = d.d?.results?.[0];
                console.log(`[${timestamp}] [checkExistingRegistration] Result for Event ID ${id}:`, reg || "None");
                resolve(reg);
              },
              error: xhr => {
                console.warn(`[${timestamp}] [checkExistingRegistration] Failed for Event ID ${id}:`, xhr);
                resolve(null);
              }
            });
          });
        };

        const register = async (id) => {
          const timestamp = new Date().toISOString();
          console.log(`[${timestamp}] [register] Attempting registration for Event ID:`, id);

          try {
            setLoading(true);
            $("#loading").show();
            console.log(`[${timestamp}] [register] Loading state set to true`);

            if (!Number.isInteger(id) || id <= 0) {
              console.error(`[${timestamp}] [register] Invalid Event ID:`, id);
              alert("Invalid event ID.");
              setLoading(false);
              return;
            }
            console.log(`[${timestamp}] [register] Event ID validated:`, id);

            const ev = events.find(e => e.Id === id);
            if (!ev) {
              console.error(`[${timestamp}] [register] Event not found for ID:`, id);
              alert("Event not found.");
              setLoading(false);
              return;
            }
            console.log(`[${timestamp}] [register] Event found:`, ev);

            if (!ev.AllowRegistration) {
              console.warn(`[${timestamp}] [register] Registration closed for Event ID:`, id, `AllowRegistration:`, ev.AllowRegistration);
              alert("Registration closed for this event.");
              setLoading(false);
              return;
            }

            const endDate = new Date(ev.EndTime);
            const now = new Date();
            const isPast = endDate.getTime() < now.getTime();
            console.log(`[${timestamp}] [register] Date check:`, {
              EndTime: ev.EndTime,
              ParsedEnd: endDate.toISOString(),
              Now: now.toISOString(),
              isPast
            });
            if (isPast) {
              console.warn(`[${timestamp}] [register] Event is past for Event ID:`, id, `EndTime:`, ev.EndTime);
              alert("This event has ended.");
              setLoading(false);
              return;
            }
            console.log(`[${timestamp}] [register] Event is open for registration:`, ev.Title);

            if (!userEmailRef.current || userEmailRef.current === 'unknown') {
              console.error(`[${timestamp}] [register] Invalid userEmail:`, userEmailRef.current);
              alert("Invalid user email. Cannot proceed with registration.");
              setLoading(false);
              return;
            }
            console.log(`[${timestamp}] [register] User email validated:`, userEmailRef.current);

            console.log(`[${timestamp}] [register] Double-checking via REST...`);
            const existingReg = await checkExistingRegistration(id);
            if (existingReg) {
              console.log(`[${timestamp}] [register] Already registered via REST for Event ID ${id}:`, existingReg);
              alert("You are already " + (existingReg.Status === 'Confirmed' ? "registered" : `waitlisted (#${existingReg.WaitlistPosition})`));
              setLoading(false);
              return;
            }
            console.log(`[${timestamp}] [register] No existing registration via REST`);

            console.log(`[${timestamp}] [register] Checking seat availability...`);
            const count = await getRegCount(id);
            const full = ev.MaxSeats && count >= ev.MaxSeats;
            console.log(`[${timestamp}] [register] Event ID ${id} - Seats: ${count}/${ev.MaxSeats || 'Unlimited'}, Full: ${full}`);

            console.log(`[${timestamp}] [register] Refreshing digest before registration...`);
            digestRef.current = await refreshDigest(siteRef.current);
            if (!digestRef.current) {
              console.error(`[${timestamp}] [register] Failed to refresh digest`);
              alert("Failed to refresh form digest. Please try again.");
              setLoading(false);
              return;
            }

            if (!full) {
              console.log(`[${timestamp}] [register] Creating confirmed registration...`);
              await createReg(id, 'Confirmed', null, ev.Title);
            } else {
              const pos = await getNextWaitlistPosition(id);
              console.log(`[${timestamp}] [register] Event full. Offering waitlist position:`, pos);
              if (confirm(`Event full. Join waitlist #${pos}?`)) {
                console.log(`[${timestamp}] [register] Creating waitlist registration...`);
                await createReg(id, 'Waitlisted', pos, ev.Title);
              } else {
                console.log(`[${timestamp}] [register] User declined waitlist for Event ID:`, id);
                alert("Waitlist registration cancelled.");
                setLoading(false);
                return;
              }
            }
          } catch (err) {
            console.error(`[${timestamp}] [register] Unexpected error in registration:`, err);
            handleError("Register", err, "Failed to process registration. Please check permissions or list settings.");
            setLoading(false);
          }
        };

        const createReg = async (id, status, pos, title, retryCount = 0) => {
          const maxRetries = 2;
          const timestamp = new Date().toISOString();
          const registrationDate = new Date().toISOString();
          console.log(`[${timestamp}] [createReg] Creating registration for Event ID:`, id, {
            userEmail: userEmailRef.current,
            status,
            waitlistPosition: pos,
            title,
            registrationDate,
            retryCount
          });

          try {
            const eventExists = events.some(e => e.Id === id);
            if (!eventExists) {
              console.error(`[${timestamp}] [createReg] Event ID ${id} does not exist in state`);
              throw new Error(`Event ID ${id} not found in loaded events.`);
            }

            if (!userEmailRef.current || userEmailRef.current === 'unknown') {
              console.error(`[${timestamp}] [createReg] Invalid userEmail:`, userEmailRef.current);
              throw new Error("Invalid user email. Cannot create registration.");
            }

            const validEvent = await validateEventId(id);
            if (!validEvent) {
              console.error(`[${timestamp}] [createReg] Invalid Event ID ${id} in Events list`);
              throw new Error(`Event ID ${id} does not exist in Events list.`);
            }

            digestRef.current = await refreshDigest(siteRef.current);
            if (!digestRef.current) {
              console.error(`[${timestamp}] [createReg] Failed to refresh digest`);
              throw new Error("Failed to refresh digest for registration.");
            }

            const response = await $.ajax({
              url: siteRef.current + "/_api/web/lists/getbytitle('Registrations')/items",
              type: "POST",
              data: JSON.stringify({
                '__metadata': { type: 'SP.Data.RegistrationsListItem' },
                EventLookupIdId: id,
                UserEmail: userEmailRef.current,
                Status: status,
                WaitlistPosition: pos !== null ? pos : null,
                Title: title || "Event Registration",
                RegistrationDate: registrationDate
              }),
              headers: {
                Accept: "application/json; odata=verbose",
                "X-RequestDigest": digestRef.current,
                "Content-Type": "application/json; odata=verbose"
              },
              timeout: 15000
            });
            console.log(`[${timestamp}] [createReg] Registration created successfully for Event ID ${id}:`, response);
            alert(status === 'Confirmed' ? 'Registered successfully!' : `Added to waitlist #${pos}`);
            await loadEvents();
            await loadMyRegs();
            setLoading(false);
          } catch (xhr) {
            const msg = xhr.responseJSON?.error?.message?.value || "Registration failed";
            console.error(`[${timestamp}] [createReg] Error for Event ID ${id}:`, msg, {
              status: xhr.status,
              statusText: xhr.statusText,
              response: xhr.responseJSON || xhr.responseText
            });

            if ((msg.includes("A list item with ID") || msg.includes("already exists")) && retryCount < maxRetries) {
              console.log(`[${timestamp}] [createReg] Duplicate error detected. Retrying (${retryCount + 1}/${maxRetries})...`);
              await loadMyRegs();
              const existingReg = await checkExistingRegistration(id);
              if (existingReg) {
                console.log(`[${timestamp}] [createReg] Confirmed existing registration on retry:`, existingReg);
                alert("You are already " + (existingReg.Status === 'Confirmed' ? "registered" : `waitlisted (#${existingReg.WaitlistPosition})`));
                setLoading(false);
              } else {
                console.log(`[${timestamp}] [createReg] No existing registration on retry. Attempting again...`);
                await createReg(id, status, pos, title, retryCount + 1);
              }
            } else {
              let userMsg = `Failed to register: ${msg}`;
              if (xhr.status === 403) userMsg = "Access denied. Please check your permissions to add items to the Registrations list.";
              if (xhr.status === 400) userMsg = "Invalid request. Please check list settings, Event ID, or required fields.";
              if (xhr.status === 404) userMsg = "Registrations list not found. Verify list name.";
              if (xhr.status === 409) userMsg = "Duplicate registration detected. Please check existing registrations.";
              handleError("Create Registration", xhr, userMsg);
              setLoading(false);
            }
          }
        };

        const validateEventId = (id) => {
          const timestamp = new Date().toISOString();
          console.log(`[${timestamp}] [validateEventId] Validating Event ID:`, id);

          return new Promise(resolve => {
            $.ajax({
              url: siteRef.current + "/_api/web/lists/getbytitle('Events')/items(" + id + ")?$select=Id",
              headers: { Accept: "application/json; odata=verbose" },
              timeout: 5000,
              success: d => {
                console.log(`[${timestamp}] [validateEventId] Event ID ${id} is valid`);
                resolve(true);
              },
              error: xhr => {
                console.warn(`[${timestamp}] [validateEventId] Event ID ${id} is invalid:`, xhr);
                resolve(false);
              }
            });
          });
        };

        const getNextWaitlistPosition = (id) => {
          const timestamp = new Date().toISOString();
          console.log(`[${timestamp}] [getNextWaitlistPosition] Getting next waitlist position for Event ID:`, id);

          return new Promise(r => {
            $.ajax({
              url: siteRef.current + "/_api/web/lists/getbytitle('Registrations')/items?$filter=EventLookupId eq " + id + " and Status eq 'Waitlisted'&$orderby=WaitlistPosition desc&$top=1&$select=WaitlistPosition",
              headers: { Accept: "application/json; odata=verbose" },
              timeout: 5000,
              success: d => {
                const pos = (d.d?.results?.[0]?.WaitlistPosition || 0) + 1;
                console.log(`[${timestamp}] [getNextWaitlistPosition] Next position for Event ID ${id}:`, pos);
                r(pos);
              },
              error: xhr => {
                console.warn(`[${timestamp}] [getNextWaitlistPosition] Failed for Event ID ${id}:`, xhr);
                r(1);
              }
            });
          });
        };

        const showUnreg = (id) => {
          const timestamp = new Date().toISOString();
          console.log(`[${timestamp}] [showUnreg] Showing unregister modal for Event ID:`, id);
          if (!Number.isInteger(id) || id <= 0) {
            console.error(`[${timestamp}] [showUnreg] Invalid Event ID:`, id);
            alert("Invalid event ID for unregister.");
            return;
          }
          setUnregId(id);
          setShowModal(true);
          console.log(`[${timestamp}] [showUnreg] React modal shown, unregId set to:`, id);
          setTimeout(() => {
            console.log(`[${timestamp}] [showUnreg] Modal DOM check:`, {
              modal: !!document.querySelector(".modal"),
              backdrop: !!document.querySelector(".modal-backdrop")
            });
          }, 100);
        };

        const unregister = async (eventId) => {
          const timestamp = new Date().toISOString();
          console.log(`[${timestamp}] [unregister] Unregistering for Event ID:`, eventId);

          if (!Number.isInteger(eventId) || eventId <= 0) {
            console.error(`[${timestamp}] [unregister] Invalid Event ID:`, eventId);
            alert("Invalid event ID for unregister.");
            setLoading(false);
            setShowModal(false);
            return;
          }

          try {
            setLoading(true);
            $("#loading").show();
            setShowModal(false);

            console.log(`[${timestamp}] [unregister] Refreshing digest before unregister...`);
            digestRef.current = await refreshDigest(siteRef.current);
            if (!digestRef.current) {
              console.error(`[${timestamp}] [unregister] Failed to refresh digest`);
              throw new Error("Failed to refresh digest for unregister.");
            }

            const query = `${siteRef.current}/_api/web/lists/getbytitle('Registrations')/items` +
                          `?$filter=EventLookupId eq ${eventId} and UserEmail eq '${userEmailRef.current.replace(/'/g, "''")}'` +
                          `&$select=Id,EventLookupId/Id,Status,UserEmail&$expand=EventLookupId`;
            console.log(`[${timestamp}] [unregister] Query URL:`, query);

            const response = await $.ajax({
              url: query,
              headers: { Accept: "application/json; odata=verbose" },
              timeout: 5000
            });
            const reg = response.d?.results?.[0];
            if (!reg) {
              console.warn(`[${timestamp}] [unregister] No registration found for Event ID:`, eventId, "User:", userEmailRef.current);
              alert("You are not registered for this event.");
              setLoading(false);
              return;
            }

            console.log(`[${timestamp}] [unregister] Found registration ID:`, reg.Id, "Details:", {
              EventLookupId: reg.EventLookupId?.Id,
              Status: reg.Status,
              UserEmail: reg.UserEmail
            });

            await $.ajax({
              url: siteRef.current + "/_api/web/lists/getbytitle('Registrations')/items(" + reg.Id + ")",
              type: "POST",
              headers: {
                Accept: "application/json; odata=verbose",
                "X-RequestDigest": digestRef.current,
                "If-Match": "*",
                "X-HTTP-Method": "DELETE"
              },
              timeout: 5000
            });
            console.log(`[${timestamp}] [unregister] Registration deleted successfully for Event ID:`, eventId);
            await loadEvents();
            await loadMyRegs();
            alert("Registration cancelled successfully.");
            setLoading(false);
            setUnregId(null);
          } catch (xhr) {
            console.error(`[${timestamp}] [unregister] Error unregistering for Event ID ${eventId}:`, {
              status: xhr.status,
              statusText: xhr.statusText,
              response: xhr.responseJSON || xhr.responseText
            });
            let userMsg = "Failed to cancel registration.";
            if (xhr.status === 403) userMsg = "Access denied. Please check your permissions.";
            if (xhr.status === 404) userMsg = "Registration or list not found.";
            if (xhr.status === 400) userMsg = "Invalid request. Please check list settings.";
            handleError("Unregister", xhr, userMsg);
            setLoading(false);
            setUnregId(null);
          }
        };

        const handleConfirmUnreg = () => {
          const timestamp = new Date().toISOString();
          console.log(`[${timestamp}] [confirmUnreg] Unregister clicked, unregId:`, unregId);
          if (appInstance && typeof appInstance.unregister === 'function') {
            if (unregId !== null && Number.isInteger(unregId) && unregId > 0) {
              appInstance.unregister(unregId);
            } else {
              console.error(`[${timestamp}] [confirmUnreg] Invalid unregId:`, unregId);
              alert("Error: Invalid event ID for unregister. Please try again.");
              setShowModal(false);
            }
          } else {
            console.error(`[${timestamp}] [confirmUnreg] appInstance.unregister is not a function`, appInstance);
            alert("Error: Unable to cancel registration. Please check console for details.");
            setShowModal(false);
          }
        };

        const renderApp = () => {
          const timestamp = new Date().toISOString();
          console.log(`[${timestamp}] [renderApp] START Rendering app, state:`, { loading, events: events.length, myRegs: myRegs.length, showModal, unregId });

          const root = document.getElementById('root');
          if (!root) {
            console.error(`[${timestamp}] [renderApp] #root element not found`);
            alert("Error: #root element not found in DOM. Check EventsDashboard.aspx.");
            setLoading(false);
            return;
          }

          // Clear and validate root
          root.innerHTML = '';
          root.style.display = 'block';
          root.style.visibility = 'visible';
          console.log(`[${timestamp}] [renderApp] Root cleared, status:`, {
            exists: !!root,
            innerHTML: root.innerHTML,
            display: root.style.display,
            visibility: root.style.visibility
          });

          $("#loading").hide();
          console.log(`[${timestamp}] [renderApp] Loading element hidden`);

          try {
            if (loading) {
              console.log(`[${timestamp}] [renderApp] Still loading, rendering loading state`);
              const loadingElement = React.createElement("div", { className: "alert alert-info text-center" }, "Loading events...");
              reactRoot = reactRoot || ReactDOM.createRoot(root);
              reactRoot.render(loadingElement);
              console.log(`[${timestamp}] [renderApp] Loading state rendered, DOM check:`, {
                rootContent: root.innerHTML.substring(0, 100) + "..."
              });
              return;
            }

            if (!events.length) {
              console.warn(`[${timestamp}] [renderApp] No events to render`, events);
              const noEventsElement = React.createElement("div", { className: "alert alert-info text-center" }, "No events found. Please check Events list or permissions.");
              reactRoot = reactRoot || ReactDOM.createRoot(root);
              reactRoot.render(noEventsElement);
              console.log(`[${timestamp}] [renderApp] No events state rendered, DOM check:`, {
                rootContent: root.innerHTML.substring(0, 100) + "..."
              });
              return;
            }

            console.log(`[${timestamp}] [renderApp] Rendering EventCards with ${events.length} events`);
            const appElement = React.createElement(ErrorBoundary, null,
              React.createElement("div", { className: "event-container" },
                React.createElement(EventCards, {
                  events,
                  myRegs,
                  search,
                  register,
                  showUnreg,
                  refreshMyRegs
                }),
                React.createElement(UnregModal)
              )
            );
            reactRoot = reactRoot || ReactDOM.createRoot(root);
            reactRoot.render(appElement);
            console.log(`[${timestamp}] [renderApp] Rendered successfully, checking DOM:`, {
              rootContent: root.innerHTML.substring(0, 100) + "...",
              eventContainer: !!document.querySelector(".event-container"),
              cards: !!document.querySelector(".event-row"),
              panels: document.querySelectorAll(".panel").length,
              modal: !!document.querySelector(".modal"),
              backdrop: !!document.querySelector(".modal-backdrop")
            });

            // Force DOM repaint
            root.style.display = 'none';
            root.offsetHeight;
            root.style.display = 'block';
            console.log(`[${timestamp}] [renderApp] Forced DOM repaint`);
          } catch (e) {
            console.error(`[${timestamp}] [renderApp] Render failed:`, e);
            handleError("Render App", e, "Failed to render event cards or modal. Check React version or DOM setup.");
            setLoading(false);
          }
        };

        return null;
      };

      const root = document.getElementById('root');
      if (!root) {
        console.error(`[${timestamp}] [App Init] #root element not found in DOM`);
        alert("Error: #root element not found in DOM. Check EventsDashboard.aspx.");
        return;
      }

      root.style.display = 'block';
      root.style.visibility = 'visible';
      console.log(`[${timestamp}] [App Init] Root initialized, CSS:`, {
        display: root.style.display,
        visibility: root.style.visibility
      });

      try {
        reactRoot = ReactDOM.createRoot(root);
        reactRoot.render(React.createElement(App));
        $("#loading").show();
        console.log(`[${timestamp}] [App Init] App rendered with createRoot, loading shown`);
      } catch (e) {
        console.error(`[${timestamp}] [App Init] Failed to render app:`, e);
        handleError("App Init", e, "Failed to initialize app. Check React CDN or console.");
      }
    } catch (err) {
      handleError("App Init", err, "Failed to initialize app.");
    }
  });
})();