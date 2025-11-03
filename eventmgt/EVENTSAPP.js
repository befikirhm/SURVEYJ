// === SP 2016 ON-PREM – FIXED LOADING ISSUE, FUNCTIONAL COMPONENT ===
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
      ReactDOM.render(React.createElement("div", { className: "alert alert-danger" }, `${userMsg}\n\nCheck F12 Console for details.`), root);
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

    let appInstance = null;

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

        // Context Refs
        const siteRef = React.useRef(ctx.site);
        const userEmailRef = React.useRef(ctx.userEmail);
        const digestRef = React.useRef(ctx.digest);

        // useEffect for rendering cards when state changes
        React.useEffect(() => {
          const timestamp = new Date().toISOString();
          console.log(`[${timestamp}] [useEffect] State changed, rendering cards:`, { events: events.length, search, loading });
          renderCards();
        }, [events, search, myRegs, loading]);

        // useEffect for componentDidMount
        React.useEffect(() => {
          const timestamp = new Date().toISOString();
          console.log(`[${timestamp}] [useEffect] Initializing component...`);

          const root = document.getElementById('root');
          if (!root) {
            console.error(`[${timestamp}] [useEffect] #root element not found in DOM`);
            alert("Error: #root element not found in DOM. Check EventsDashboard.aspx.");
            return;
          }

          appInstance = {
            unregister,
            refreshMyRegs,
            showUnreg,
            register
          };

          $('#searchBox').on('input', handleSearch);

          // Timeout to prevent infinite loading
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
              .then(() => {
                console.log(`[${timestamp}] [useEffect] All data loaded, clearing timeout`);
                clearTimeout(timeout);
                setLoading(false);
                renderCards();
              })
              .catch(err => {
                console.error(`[${timestamp}] [useEffect] Error loading data:`, err);
                clearTimeout(timeout);
                setLoading(false);
                handleError("Load Data", err, "Failed to load events or registrations.");
                renderCards();
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
            ReactDOM.render(links, adminRoot);
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
                  let evs = (d.d?.results || []).map(ev => {
                    console.log(`[${timestamp}] [loadEvents] Processing event:`, ev.Id, ev.Title);
                    return {
                      Id: ev.Id,
                      Title: ev.Title || "Untitled Event",
                      StartTime: ev.StartDate || new Date().toISOString(),
                      EndTime: ev.EndDate || new Date().toISOString(),
                      Room: ev.Location || "TBD",
                      Instructor: ev.Instructor || "TBD",
                      MaxSeats: ev.MaxSeats || null,
                      AllowRegistration: ev.AllowRegistration === true || ev.AllowRegistration === "1",
                      IsOver: ev.IsOver === true || ev.IsOver === "1",
                      Attachments: ev.Attachments || false,
                      regCount: 0
                    };
                  }).sort((a, b) => new Date(a.StartTime) - new Date(b.EndTime));

                  console.log(`[${timestamp}] [loadEvents] Events processed:`, evs.length, evs);

                  if (evs.length === 0) {
                    console.log(`[${timestamp}] [loadEvents] No events found in response`);
                    setEvents([]);
                    resolve([]);
                    return;
                  }

                  Promise.all(evs.map(e => getRegCount(e.Id).then(c => ({ ...e, regCount: c }))))
                    .then(processed => {
                      console.log(`[${timestamp}] [loadEvents] Events with reg counts:`, processed.length);
                      setEvents([...processed]);
                      resolve(processed);
                    })
                    .catch(err => {
                      console.warn(`[${timestamp}] [loadEvents] Error processing reg counts:`, err);
                      setEvents([...evs.map(e => ({ ...e, regCount: 0 }))]);
                      resolve(evs);
                    });
                } catch (err) {
                  console.error(`[${timestamp}] [loadEvents] Error parsing events:`, err);
                  handleError("Parse Events", err, "Failed to parse events data. Check list columns or response format.");
                  setEvents([]);
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
                setEvents([]);
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
              setMyRegs([]);
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
                  setMyRegs([...registrations]);
                  resolve(registrations);
                } catch (e) {
                  console.error(`[${timestamp}] [loadMyRegs] Error parsing registrations:`, e);
                  handleError("Parse Registrations", e, "Failed to parse user registrations.");
                  setMyRegs([]);
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
                setMyRegs([]);
                resolve([]);
              }
            });
          });
        };

        const refreshMyRegs = () => {
          const timestamp = new Date().toISOString();
          console.log(`[${timestamp}] [refreshMyRegs] Manually refreshing registrations...`);
          setLoading(true);
          loadMyRegs().then(() => {
            setLoading(false);
            renderCards();
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

            if (!Number.isInteger(id) || id <= 0) {
              console.error(`[${timestamp}] [register] Invalid Event ID:`, id);
              alert("Invalid event ID.");
              setLoading(false);
              renderCards();
              return;
            }
            console.log(`[${timestamp}] [register] Event ID validated:`, id);

            const ev = events.find(e => e.Id === id);
            if (!ev) {
              console.error(`[${timestamp}] [register] Event not found for ID:`, id);
              alert("Event not found.");
              setLoading(false);
              renderCards();
              return;
            }
            if (!ev.AllowRegistration) {
              console.warn(`[${timestamp}] [register] Registration closed for Event ID:`, id);
              alert("Registration closed.");
              setLoading(false);
              renderCards();
              return;
            }
            console.log(`[${timestamp}] [register] Event validated:`, ev.Title);

            if (!userEmailRef.current || userEmailRef.current === 'unknown') {
              console.error(`[${timestamp}] [register] Invalid userEmail:`, userEmailRef.current);
              alert("Invalid user email. Cannot proceed with registration.");
              setLoading(false);
              renderCards();
              return;
            }

            console.log(`[${timestamp}] [register] Before loadMyRegs...`);
            let myRegsLocal = [];
            try {
              myRegsLocal = await loadMyRegs();
              console.log(`[${timestamp}] [register] After loadMyRegs, registrations:`, myRegsLocal.length, myRegsLocal);
            } catch (err) {
              console.error(`[${timestamp}] [register] loadMyRegs failed:`, err);
              handleError("Load My Registrations in Register", err, "Failed to load registrations. Please try again.");
              setLoading(false);
              renderCards();
              return;
            }

            const localReg = myRegsLocal.find(r => r.EventLookupId === ev.Id);
            if (localReg) {
              console.log(`[${timestamp}] [register] Found in local state for Event ID ${id}:`, localReg);
              alert("You are already " + (localReg.Status === 'Confirmed' ? "registered" : `waitlisted (#${localReg.WaitlistPosition})`));
              setLoading(false);
              renderCards();
              return;
            }
            console.log(`[${timestamp}] [register] No local registration found`);

            console.log(`[${timestamp}] [register] Double-checking via REST...`);
            const existingReg = await checkExistingRegistration(id);
            if (existingReg) {
              console.log(`[${timestamp}] [register] Already registered via REST for Event ID ${id}:`, existingReg);
              alert("You are already " + (existingReg.Status === 'Confirmed' ? "registered" : `waitlisted (#${existingReg.WaitlistPosition})`));
              setLoading(false);
              renderCards();
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
              renderCards();
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
                renderCards();
                return;
              }
            }
          } catch (err) {
            console.error(`[${timestamp}] [register] Unexpected error in registration:`, err);
            handleError("Register", err, "Failed to process registration. Please check permissions or list settings.");
            setLoading(false);
            renderCards();
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
            renderCards();
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
                renderCards();
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
              renderCards();
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
          setUnregId(id);
          $("#unregModal").modal("show");
        };

        const unregister = async () => {
          const timestamp = new Date().toISOString();
          console.log(`[${timestamp}] [unregister] Unregistering for Event ID:`, unregId);

          $("#unregModal").modal("hide");

          try {
            setLoading(true);
            $("#loading").show();

            console.log(`[${timestamp}] [unregister] Refreshing digest before unregister...`);
            digestRef.current = await refreshDigest(siteRef.current);
            if (!digestRef.current) {
              throw new Error("Failed to refresh digest for unregister.");
            }

            const query = `${siteRef.current}/_api/web/lists/getbytitle('Registrations')/items` +
                          `?$filter=EventLookupId eq ${unregId} and UserEmail eq '${userEmailRef.current.replace(/'/g, "''")}'` +
                          `&$select=Id,EventLookupId/Id&$expand=EventLookupId`;
            console.log(`[${timestamp}] [unregister] Query URL:`, query);

            const response = await $.ajax({
              url: query,
              headers: { Accept: "application/json; odata=verbose" },
              timeout: 5000
            });
            const reg = response.d?.results?.[0];
            if (!reg) {
              console.warn(`[${timestamp}] [unregister] No registration found for Event ID:`, unregId);
              alert("You are not registered for this event.");
              setLoading(false);
              renderCards();
              return;
            }

            console.log(`[${timestamp}] [unregister] Deleting registration ID:`, reg.Id);
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
            console.log(`[${timestamp}] [unregister] Registration deleted successfully for Event ID:`, unregId);
            await loadEvents();
            await loadMyRegs();
            alert("Registration cancelled successfully.");
            setLoading(false);
            renderCards();
          } catch (xhr) {
            console.error(`[${timestamp}] [unregister] Error unregistering for Event ID ${unregId}:`, xhr);
            let userMsg = "Failed to cancel registration.";
            if (xhr.status === 403) userMsg = "Access denied. Please check your permissions.";
            if (xhr.status === 404) userMsg = "Registration not found.";
            if (xhr.status === 400) userMsg = "Invalid request. Please check list settings.";
            handleError("Unregister", xhr, userMsg);
            setLoading(false);
            renderCards();
          }
        };

        const renderCards = () => {
          const timestamp = new Date().toISOString();
          console.log(`[${timestamp}] [renderCards] Rendering event cards...`, { events: events.length, search, loading });

          const root = document.getElementById('root');
          if (!root) {
            console.error(`[${timestamp}] [renderCards] #root element not found`);
            alert("Error: #root element not found in DOM. Check EventsDashboard.aspx.");
            return;
          }

          $("#loading").hide();

          if (loading) {
            console.log(`[${timestamp}] [renderCards] Still loading, rendering loading state`);
            ReactDOM.render(React.createElement("div", { className: "alert alert-info" }, "Loading events..."), root);
            return;
          }

          const filtered = events.filter(e =>
            (e.Title || "").toLowerCase().includes(search) ||
            (e.Room || "").toLowerCase().includes(search)
          );
          console.log(`[${timestamp}] [renderCards] Filtered events:`, filtered.length, filtered);

          const cards = filtered.length ? filtered.map(ev => {
            const myReg = myRegs.find(r => r.EventLookupId === ev.Id);
            const isFull = ev.MaxSeats && ev.regCount >= ev.MaxSeats;
            const isPast = new Date(ev.EndTime) < new Date();
            const canReg = ev.AllowRegistration && !isPast;

            console.log(`[${timestamp}] [renderCards] Event ID ${ev.Id}:`, {
              title: ev.Title,
              isFull,
              isPast,
              canReg,
              registered: !!myReg,
              status: myReg?.Status
            });

            const panelCls = isFull || isPast ? "panel panel-default card-full" + (isPast ? " card-past" : "") : "panel panel-primary";

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

            return React.createElement("div", { key: ev.Id, className: "col-md-6 mb-3" },
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
          }) : [React.createElement("div", { key: "no", className: "alert alert-info" }, "No events found. Please check Events list or permissions.")];

          console.log(`[${timestamp}] [renderCards] Rendering ${cards.length} cards`);
          try {
            ReactDOM.render(React.createElement("div", { className: "row" }, cards), root);
          } catch (e) {
            console.error(`[${timestamp}] [renderCards] ReactDOM.render failed:`, e);
            handleError("Render Cards", e, "Failed to render event cards. Check React version or DOM setup.");
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

      $(document).on('click', '#confirmUnreg', () => {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [confirmUnreg] Unregister button clicked`);
        if (appInstance && typeof appInstance.unregister === 'function') {
          appInstance.unregister();
        } else {
          console.error(`[${timestamp}] [confirmUnreg] appInstance.unregister is not a function`, appInstance);
          alert("Error: Unable to cancel registration. Please check console for details.");
        }
      });

      const app = React.createElement(App);
      ReactDOM.render(app, root);
      $("#loading").show();
      console.log(`[${timestamp}] [App Init] App rendered, loading shown`);

    } catch (err) {
      handleError("App Init", err, "Failed to initialize app.");
    }
  });
})();