// === SP 2016 ON-PREM – MODULAR EVENTS APP ===
(function (global, React, ReactDOM, $) {
  'use strict';

  // === API UTILITIES ===
  const api = {
    handleError(step, error, userMsg = "An error occurred.") {
      const timestamp = new Date().toISOString();
      console.error(`[${timestamp}] [API ${step}]:`, {
        message: error.message || "No message",
        status: error.status || "N/A",
        statusText: error.statusText || "N/A",
        response: error.responseJSON || error.responseText || "No response",
        stack: error.stack || "No stack"
      });
      return { error: true, message: userMsg, details: error };
    },

    refreshDigest(site) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [API refreshDigest] Fetching new digest...`);
      return $.ajax({
        url: site + "/_api/contextinfo",
        method: "POST",
        headers: { Accept: "application/json; odata=verbose" },
        timeout: 5000
      }).then(resp => {
        const digest = resp.d.GetContextWebInformation.FormDigestValue;
        console.log(`[${timestamp}] [API refreshDigest] Digest:`, digest.substring(0, 20) + "...");
        return digest;
      }).catch(e => this.handleError("refreshDigest", e, "Failed to refresh form digest."));
    },

    getContext() {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [API getContext] Starting...`);
      return new Promise(async (resolve) => {
        try {
          let site = _spPageContextInfo?.webAbsoluteUrl?.replace(/\/$/, '') || window.location.origin + (window.location.pathname.match(/\/sites\/[^\/]+|\/[^\/]+/)?.[0] || '');
          console.log(`[${timestamp}] [API getContext] Site URL:`, site);

          const userResp = await $.ajax({
            url: site + "/_api/web/currentuser",
            headers: { Accept: "application/json; odata=verbose" },
            timeout: 10000
          });
          const userEmail = userResp.d.Email || userResp.d.LoginName || _spPageContextInfo?.userLoginName || 'unknown';
          console.log(`[${timestamp}] [API getContext] User Email:`, userEmail);

          let digest = $("#FormDigest1").val() || $("#__REQUESTDIGEST").val() || '';
          if (!digest) {
            console.warn(`[${timestamp}] [API getContext] FormDigest1 not found, refreshing...`);
            digest = await this.refreshDigest(site);
            if (digest.error) return resolve(digest);
          }
          console.log(`[${timestamp}] [API getContext] Digest:`, digest.substring(0, 20) + "...");

          if (!site || !userEmail || !digest) {
            return resolve(this.handleError("getContext", new Error("Incomplete context"), "Missing site, user, or digest."));
          }
          resolve({ site, userEmail, digest });
        } catch (e) {
          resolve(this.handleError("getContext", e, "Failed to load SharePoint context."));
        }
      });
    },

    loadEvents(site, digest, maxRetries = 2) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [API loadEvents] Starting, retries: ${maxRetries}`);
      const q = "?$select=Id,Title,StartDate,EndDate,Location,Instructor,MaxSeats,AllowRegistration,IsOver,Attachments";
      const url = site + "/_api/web/lists/getbytitle('Events')/items" + q;

      const attemptLoad = (attempt) => {
        return $.ajax({ url, headers: { Accept: "application/json; odata=verbose" }, timeout: 15000 }).then(d => {
          console.log(`[${timestamp}] [API loadEvents] Raw response:`, d);
          let evs = (d.d?.results || []).map((ev, index) => {
            const startDate = ev.StartDate ? new Date(ev.StartDate) : null;
            const endDate = ev.EndDate ? new Date(ev.EndDate) : null;
            console.log(`[${timestamp}] [API loadEvents] Event ${index + 1}:`, { Id: ev.Id, Title: ev.Title, StartDate: ev.StartDate });
            if (!ev.Id || !ev.Title || !startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
              console.warn(`[${timestamp}] [API loadEvents] Skipping invalid event:`, ev);
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

          console.log(`[${timestamp}] [API loadEvents] Events processed:`, evs.length);
          if (evs.length === 0) return evs;

          return Promise.all(evs.map(e => this.getRegCount(site, e.Id).then(c => ({ ...e, regCount: c }))))
            .then(processed => {
              console.log(`[${timestamp}] [API loadEvents] Events with reg counts:`, processed.length);
              return processed;
            });
        }).catch(xhr => {
          if (attempt < maxRetries) {
            console.warn(`[${timestamp}] [API loadEvents] Attempt ${attempt} failed, retrying...`);
            return attemptLoad(attempt + 1);
          }
          let msg = "Failed to load events.";
          if (xhr.status === 404) msg = "List 'Events' not found.";
          if (xhr.status === 403) msg = "Access denied to Events list.";
          return this.handleError("loadEvents", xhr, msg);
        });
      };
      return attemptLoad(1);
    },

    loadMyRegs(site, userEmail, maxRetries = 2) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [API loadMyRegs] Starting for:`, userEmail);
      if (!userEmail || userEmail === 'unknown') {
        return Promise.resolve(this.handleError("loadMyRegs", new Error("Invalid user email"), "Cannot load registrations."));
      }

      const query = `${site}/_api/web/lists/getbytitle('Registrations')/items` +
                    `?$filter=UserEmail eq '${userEmail.replace(/'/g, "''")}'` +
                    `&$select=Id,EventLookupId,Status,WaitlistPosition,Title,RegistrationDate,EventLookupId/Id` +
                    `&$expand=EventLookupId`;

      const attemptLoad = (attempt) => {
        return $.ajax({ url: query, headers: { Accept: "application/json; odata=verbose" }, timeout: 20000 }).then(d => {
          console.log(`[${timestamp}] [API loadMyRegs] Raw response:`, d);
          const registrations = (d.d?.results || []).map(r => ({
            Id: r.Id,
            EventLookupId: r.EventLookupId?.Id || r.EventLookupId,
            Title: r.Title || "Unknown",
            Status: r.Status,
            WaitlistPosition: r.WaitlistPosition,
            RegistrationDate: r.RegistrationDate
          }));
          console.log(`[${timestamp}] [API loadMyRegs] Loaded:`, registrations.length);
          return registrations;
        }).catch(xhr => {
          if (attempt < maxRetries) {
            console.warn(`[${timestamp}] [API loadMyRegs] Attempt ${attempt} failed, retrying...`);
            return attemptLoad(attempt + 1);
          }
          let msg = "Failed to load registrations.";
          if (xhr.status === 403) msg = "Access denied to Registrations list.";
          if (xhr.status === 404) msg = "Registrations list not found.";
          return this.handleError("loadMyRegs", xhr, msg);
        });
      };
      return attemptLoad(1);
    },

    getRegCount(site, id) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [API getRegCount] Event ID:`, id);
      return $.ajax({
        url: site + "/_api/web/lists/getbytitle('Registrations')/items?$filter=EventLookupId eq " + id + " and Status eq 'Confirmed'&$select=Id",
        headers: { Accept: "application/json; odata=verbose" },
        timeout: 10000
      }).then(d => d.d?.results?.length || 0).catch(xhr => {
        console.warn(`[${timestamp}] [API getRegCount] Failed for Event ID ${id}:`, xhr);
        return 0;
      });
    },

    checkExistingRegistration(site, id, userEmail) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [API checkExistingRegistration] Event ID:`, id);
      if (!userEmail || userEmail === 'unknown') return Promise.resolve(null);
      const query = `${site}/_api/web/lists/getbytitle('Registrations')/items` +
                    `?$filter=EventLookupId eq ${id} and UserEmail eq '${userEmail.replace(/'/g, "''")}'` +
                    `&$select=Id,Status,WaitlistPosition,Title,EventLookupId/Id&$expand=EventLookupId`;
      return $.ajax({ url: query, headers: { Accept: "application/json; odata=verbose" }, timeout: 5000 })
        .then(d => d.d?.results?.[0] || null)
        .catch(xhr => {
          console.warn(`[${timestamp}] [API checkExistingRegistration] Failed:`, xhr);
          return null;
        });
    },

    validateEventId(site, id) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [API validateEventId] Event ID:`, id);
      return $.ajax({
        url: site + "/_api/web/lists/getbytitle('Events')/items(" + id + ")?$select=Id",
        headers: { Accept: "application/json; odata=verbose" },
        timeout: 5000
      }).then(d => !!d.d?.Id).catch(xhr => {
        console.warn(`[${timestamp}] [API validateEventId] Failed:`, xhr);
        return false;
      });
    },

    getNextWaitlistPosition(site, id) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [API getNextWaitlistPosition] Event ID:`, id);
      return $.ajax({
        url: site + "/_api/web/lists/getbytitle('Registrations')/items?$filter=EventLookupId eq " + id + " and Status eq 'Waitlisted'&$orderby=WaitlistPosition desc&$top=1&$select=WaitlistPosition",
        headers: { Accept: "application/json; odata=verbose" },
        timeout: 5000
      }).then(d => (d.d?.results?.[0]?.WaitlistPosition || 0) + 1).catch(xhr => {
        console.warn(`[${timestamp}] [API getNextWaitlistPosition] Failed:`, xhr);
        return 1;
      });
    },

    createReg(site, digest, id, userEmail, status, pos, title, retryCount = 0) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [API createReg] Event ID: ${id}, Status: ${status}, Retry: ${retryCount}`);
      if (!userEmail || userEmail === 'unknown') {
        return Promise.resolve(this.handleError("createReg", new Error("Invalid user email"), "Cannot register."));
      }
      return this.validateEventId(site, id).then(valid => {
        if (!valid) {
          return this.handleError("createReg", new Error(`Event ID ${id} does not exist`), "Invalid event ID.");
        }
        return $.ajax({
          url: site + "/_api/web/lists/getbytitle('Registrations')/items",
          type: "POST",
          data: JSON.stringify({
            '__metadata': { type: 'SP.Data.RegistrationsListItem' },
            EventLookupIdId: id,
            UserEmail: userEmail,
            Status: status,
            WaitlistPosition: pos !== null ? pos : null,
            Title: title || "Event Registration",
            RegistrationDate: new Date().toISOString()
          }),
          headers: {
            Accept: "application/json; odata=verbose",
            "X-RequestDigest": digest,
            "Content-Type": "application/json; odata=verbose"
          },
          timeout: 15000
        }).then(response => {
          console.log(`[${timestamp}] [API createReg] Success for Event ID ${id}:`, response);
          return { success: true, message: status === 'Confirmed' ? 'Registered successfully!' : `Added to waitlist #${pos}` };
        }).catch(async xhr => {
          const msg = xhr.responseJSON?.error?.message?.value || "Registration failed";
          if (msg.includes("already exists") && retryCount < 2) {
            const existing = await this.checkExistingRegistration(site, id, userEmail);
            if (existing) {
              return { success: false, message: `Already ${existing.Status === 'Confirmed' ? 'registered' : `waitlisted (#${existing.WaitlistPosition})`}` };
            }
            return this.createReg(site, digest, id, userEmail, status, pos, title, retryCount + 1);
          }
          let userMsg = `Failed to register: ${msg}`;
          if (xhr.status === 403) userMsg = "Access denied to Registrations list.";
          if (xhr.status === 400) userMsg = "Invalid request. Check list settings.";
          return this.handleError("createReg", xhr, userMsg);
        });
      });
    },

    unregister(site, digest, eventId, userEmail) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [API unregister] Event ID: ${eventId}`);
      const query = site + "/_api/web/lists/getbytitle('Registrations')/items" +
                    `?$filter=EventLookupId eq ${eventId} and UserEmail eq '${userEmail.replace(/'/g, "''")}'` +
                    `&$select=Id,EventLookupId/Id,Status,UserEmail&$expand=EventLookupId`;
      return $.ajax({ url: query, headers: { Accept: "application/json; odata=verbose" }, timeout: 5000 }).then(response => {
        const reg = response.d?.results?.[0];
        if (!reg) {
          return { success: false, message: "You are not registered for this event." };
        }
        return $.ajax({
          url: site + "/_api/web/lists/getbytitle('Registrations')/items(" + reg.Id + ")",
          type: "POST",
          headers: {
            Accept: "application/json; odata=verbose",
            "X-RequestDigest": digest,
            "If-Match": "*",
            "X-HTTP-Method": "DELETE"
          },
          timeout: 5000
        }).then(() => {
          console.log(`[${timestamp}] [API unregister] Success for Event ID ${eventId}`);
          return { success: true, message: "Registration cancelled successfully." };
        });
      }).catch(xhr => {
        console.error(`[${timestamp}] [API unregister] Error:`, xhr);
        let userMsg = "Failed to cancel registration.";
        if (xhr.status === 403) userMsg = "Access denied.";
        if (xhr.status === 404) userMsg = "Registration not found.";
        return this.handleError("unregister", xhr, userMsg);
      });
    },

    checkAdmin(site) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [API checkAdmin] Checking 'Event Managers'...`);
      return $.ajax({
        url: site + "/_api/web/currentuser/groups?$filter=Title eq 'Event Managers'",
        headers: { Accept: "application/json; odata=verbose" },
        timeout: 5000
      }).then(d => !!d.d?.results?.length).catch(xhr => {
        console.warn(`[${timestamp}] [API checkAdmin] Failed:`, xhr);
        return false;
      });
    }
  };

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
      console.log(`[${timestamp}] [EventCards] Rendering ${events.length} events`, { search, events: events.map(e => ({ Id: e.Id, Title: e.Title })) });

      const validEvents = events.filter(e => {
        const isValid = e &&
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
        (e.Title || "").toLowerCase().includes(search) ||
        (e.Room || "").toLowerCase().includes(search)
      );
      console.log(`[${timestamp}] [EventCards] Filtered events:`, filtered.length);

      const cards = filtered.length ? filtered.map((ev, index) => {
        console.log(`[${timestamp}] [EventCards] Processing event ${index + 1}:`, { Id: ev.Id, Title: ev.Title });
        try {
          const myReg = myRegs.find(r => r.EventLookupId === ev.Id);
          const isFull = ev.MaxSeats && ev.regCount >= ev.MaxSeats;
          const endDate = new Date(ev.EndTime);
          const now = new Date();
          const isPast = endDate.getTime() < now.getTime();
          const canReg = ev.AllowRegistration && !isPast && !ev.IsOver;

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
      }).filter(card => card !== null) : [React.createElement("div", { key: "no-events", className: "alert alert-info text-center" }, "No valid events found.")];

      console.log(`[${timestamp}] [EventCards] Generated ${cards.length} cards`);
      return React.createElement("div", { className: "row event-row" }, cards);
    },

    UnregModal({ showModal, unregId, setShowModal, handleConfirmUnreg }) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [UnregModal] Rendering, showModal: ${showModal}, unregId: ${unregId}`);
      return showModal ? [
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
      ] : null;
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

          console.log(`[${timestamp}] [App Init] SharePoint DOM:`, {
            workspace: document.getElementById('s4-workspace') ? window.getComputedStyle(document.getElementById('s4-workspace')).display : "Missing",
            bodyContainer: document.getElementById('s4-bodyContainer') ? window.getComputedStyle(document.getElementById('s4-bodyContainer')).display : "Missing"
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

            const siteRef = React.useRef(ctx.site);
            const userEmailRef = React.useRef(ctx.userEmail);
            const digestRef = React.useRef(ctx.digest);

            const renderApp = () => {
              const timestamp = new Date().toISOString();
              console.log(`[${timestamp}] [renderApp] Starting:`, { loading, events: events.length, myRegs: myRegs.length });

              if (!root) {
                console.error(`[${timestamp}] [renderApp] #root not found`);
                return;
              }
              root.innerHTML = '';
              root.style.display = 'block';
              root.style.visibility = 'visible';
              console.log(`[${timestamp}] [renderApp] Root reset:`, {
                display: root.style.display,
                visibility: root.style.visibility,
                computed: window.getComputedStyle(root).display
              });

              $("#loading").hide();
              try {
                if (loading) {
                  ReactDOM.render(
                    React.createElement("div", { className: "alert alert-info text-center" }, "Loading events..."),
                    root
                  );
                  console.log(`[${timestamp}] [renderApp] Loading state rendered`);
                  return;
                }
                if (!events.length) {
                  ReactDOM.render(
                    React.createElement("div", { className: "alert alert-info text-center" }, "No events found."),
                    root
                  );
                  console.log(`[${timestamp}] [renderApp] No events rendered`);
                  return;
                }
                console.log(`[${timestamp}] [renderApp] Attempting to render ${events.length} events`);
                ReactDOM.render(
                  React.createElement(components.ErrorBoundary, null,
                    React.createElement("div", { className: "event-container" },
                      React.createElement(components.EventCards, {
                        events: [...events],
                        myRegs: [...myRegs],
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
                  ),
                  root
                );
                console.log(`[${timestamp}] [renderApp] Render completed:`, {
                  eventContainer: !!document.querySelector(".event-container"),
                  cards: document.querySelectorAll(".panel").length,
                  modal: !!document.querySelector(".modal"),
                  rootContentLength: document.getElementById('root').innerHTML.length
                });
              } catch (e) {
                console.error(`[${timestamp}] [renderApp] Failed:`, e);
                ReactDOM.render(
                  React.createElement("div", { className: "alert alert-danger" }, `Failed to render events: ${e.message}`),
                  root
                );
                console.log(`[${timestamp}] [renderApp] Error fallback rendered`);
              }
            };

            React.useEffect(() => {
              const timestamp = new Date().toISOString();
              console.log(`[${timestamp}] [useEffect] Initializing...`);

              const timeout = setTimeout(() => {
                if (loading) {
                  console.error(`[${timestamp}] [useEffect] Loading timeout`);
                  setLoading(false);
                  renderApp();
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
                  console.log(`[${timestamp}] [useEffect] Data loaded:`, { events: eventsData.length, regs: regsData.length });
                } catch (e) {
                  console.error(`[${timestamp}] [useEffect] Data load failed:`, e);
                  setLoading(false);
                  ReactDOM.render(
                    React.createElement("div", { className: "alert alert-danger" }, `Failed to load data: ${e.message}`),
                    root
                  );
                  console.log(`[${timestamp}] [useEffect] Error fallback rendered`);
                }
                clearTimeout(timeout);
              };

              loadData();
              $('#searchBox').on('input', handleSearch);
              return () => $('#searchBox').off('input', handleSearch);
            }, []);

            React.useEffect(() => {
              const timestamp = new Date().toISOString();
              console.log(`[${timestamp}] [useEffect] State updated:`, {
                loading,
                events: events.length,
                myRegs: myRegs.length,
                showModal,
                unregId
              });
              renderApp();
            }, [loading, events, myRegs, showModal, unregId]);

            const handleSearch = (e) => {
              const timestamp = new Date().toISOString();
              console.log(`[${timestamp}] [handleSearch] Search:`, e.target.value);
              setSearch(e.target.value.toLowerCase());
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

            return null;
          };

          ReactDOM.render(React.createElement(App), root);
          $("#loading").show();
          console.log(`[${timestamp}] [App Init] App rendered`);
        } catch (e) {
          console.error(`[${timestamp}] [App Init] Failed:`, e);
          const root = document.getElementById('root');
          if (root) {
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