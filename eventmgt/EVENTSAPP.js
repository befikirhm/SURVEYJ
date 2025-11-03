// === SP 2016 ON-PREM – FIXED LOADMYREGS FAILURE + REGISTRATION ===
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
    $("#loading").hide();
    const msg = `${userMsg}\n\nCheck F12 Console for details.`;
    const root = document.getElementById('root');
    if (root) {
      ReactDOM.render(React.createElement("div", { className: "alert alert-danger" }, msg), root);
    } else {
      alert(msg);
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

      class App extends React.Component {
        constructor(props) {
          super(props);
          this.state = {
            events: [],
            myRegs: [],
            isAdmin: false,
            search: '',
            loading: true,
            unregId: null
          };
          this.handleSearch = this.handleSearch.bind(this);
          this.register = this.register.bind(this);
          this.showUnreg = this.showUnreg.bind(this);
          this.unregister = this.unregister.bind(this);
          this.refreshMyRegs = this.refreshMyRegs.bind(this);
        }

        componentDidMount() {
          const timestamp = new Date().toISOString();
          console.log(`[${timestamp}] [componentDidMount] Initializing component...`);
          this.site = ctx.site;
          this.userEmail = ctx.userEmail;
          this.digest = ctx.digest;

          appInstance = this; // Store component instance
          $('#searchBox').on('input', this.handleSearch);
          this.checkAdmin(() => {
            console.log(`[${timestamp}] [componentDidMount] Admin check done. Loading events...`);
            this.loadEvents();
            this.loadMyRegs();
          });
        }

        checkAdmin(cb) {
          const timestamp = new Date().toISOString();
          console.log(`[${timestamp}] [checkAdmin] Checking if user is in 'Event Managers'...`);
          $.ajax({
            url: this.site + "/_api/web/currentuser/groups?$filter=Title eq 'Event Managers'",
            headers: { Accept: "application/json; odata=verbose" },
            timeout: 5000,
            success: d => {
              try {
                const isAdmin = d.d?.results?.length > 0;
                console.log(`[${timestamp}] [checkAdmin] User is${isAdmin ? '' : ' not'} admin`);
                this.setState({ isAdmin });
                if (isAdmin) this.renderAdminLinks();
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
        }

        renderAdminLinks() {
          const timestamp = new Date().toISOString();
          console.log(`[${timestamp}] [renderAdminLinks] Rendering admin links...`);
          try {
            const links = React.createElement("div", null,
              React.createElement("a", { href: "AdminDashboard.aspx", className: "btn btn-warning btn-block mb-2" }, "Admin Dashboard"),
              React.createElement("a", { href: "Survey.aspx", className: "btn btn-info btn-block" }, "Design Survey")
            );
            ReactDOM.render(links, document.getElementById("adminLinks"));
            console.log(`[${timestamp}] [renderAdminLinks] Admin links rendered`);
          } catch (e) {
            handleError("Render Admin Links", e, "Failed to render admin links.");
          }
        }

        handleSearch(e) {
          const timestamp = new Date().toISOString();
          console.log(`[${timestamp}] [handleSearch] Search updated:`, e.target.value);
          this.setState({ search: e.target.value.toLowerCase() }, () => {
            if (!this.state.loading) this.renderCards();
          });
        }

        loadEvents() {
          const timestamp = new Date().toISOString();
          console.log(`[${timestamp}] [loadEvents] STARTED`);

          const q = "?$select=Id,Title,StartDate,EndDate,Location,Instructor,MaxSeats,AllowRegistration,IsOver,Attachments";
          const url = this.site + "/_api/web/lists/getbytitle('Events')/items" + q;

          $.ajax({
            url,
            headers: { Accept: "application/json; odata=verbose" },
            timeout: 15000,
            success: d => {
              console.log(`[${timestamp}] [loadEvents] Events loaded:`, d.d?.results?.length || 0);

              try {
                let evs = (d.d?.results || []).map(ev => ({
                  Id: ev.Id,
                  Title: ev.Title,
                  StartTime: ev.StartDate,
                  EndTime: ev.EndDate,
                  Room: ev.Location,
                  Instructor: { Title: ev.Instructor },
                  MaxSeats: ev.MaxSeats,
                  AllowRegistration: ev.AllowRegistration,
                  IsOver: ev.IsOver,
                  Attachments: ev.Attachments,
                  regCount: 0
                })).sort((a, b) => new Date(a.StartTime) - new Date(b.EndTime));

                if (evs.length === 0) {
                  console.log(`[${timestamp}] [loadEvents] No events found`);
                  this.setState({ events: [], loading: false }, () => {
                    $("#loading").hide();
                    this.renderCards();
                  });
                  return;
                }

                Promise.all(evs.map(e => this.getRegCount(e.Id).then(c => ({ ...e, regCount: c }))))
                  .then(processed => {
                    console.log(`[${timestamp}] [loadEvents] Events processed:`, processed.length);
                    this.setState({ events: processed, loading: false }, () => {
                      $("#loading").hide();
                      this.renderCards();
                    });
                  })
                  .catch(err => {
                    console.warn(`[${timestamp}] [loadEvents] Error processing reg counts:`, err);
                    this.setState({ events: evs.map(e => ({ ...e, regCount: 0 })), loading: false }, () => {
                      $("#loading").hide();
                      this.renderCards();
                    });
                  });
              } catch (err) {
                handleError("Parse Events", err, "Failed to parse events.");
              }
            },
            error: xhr => {
              let msg = "Failed to load events.";
              if (xhr.status === 404) msg = "List 'Events' not found.";
              if (xhr.status === 403) msg = "Access denied.";
              handleError("Load Events", xhr, msg);
            }
          });
        }

        loadMyRegs() {
          const timestamp = new Date().toISOString();
          console.log(`[${timestamp}] [loadMyRegs] Loading user registrations for:`, this.userEmail);

          return new Promise((resolve, reject) => {
            // Simplified query for SP 2016 compatibility
            const query = `${this.site}/_api/web/lists/getbytitle('Registrations')/items` +
                          `?$filter=UserEmail eq '${encodeURIComponent(this.userEmail)}'` +
                          `&$select=Id,EventLookupId,Status,WaitlistPosition,Title,RegistrationDate,EventLookupId/Id` +
                          `&$expand=EventLookupId`;
            console.log(`[${timestamp}] [loadMyRegs] Query URL:`, query);

            $.ajax({
              url: query,
              headers: { Accept: "application/json; odata=verbose" },
              timeout: 20000, // Increased timeout for slow servers
              success: d => {
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
                  this.setState({ myRegs: registrations }, () => {
                    this.renderCards();
                    resolve(registrations); // Return registrations for consistency
                  });
                } catch (e) {
                  console.error(`[${timestamp}] [loadMyRegs] Error parsing registrations:`, e);
                  handleError("Parse Registrations", e, "Failed to parse user registrations.");
                  this.setState({ myRegs: [] }, () => {
                    this.renderCards();
                    resolve([]); // Resolve with empty array on error
                  });
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
                if (xhr.status === 400) userMsg = "Invalid query. Check UserEmail or EventLookupId.";
                handleError("Load My Registrations", xhr, userMsg);
                this.setState({ myRegs: [] }, () => {
                  this.renderCards();
                  resolve([]); // Always resolve to prevent hang
                });
              }
            });
          });
        }

        refreshMyRegs() {
          const timestamp = new Date().toISOString();
          console.log(`[${timestamp}] [refreshMyRegs] Manually refreshing registrations...`);
          this.loadMyRegs();
        }

        getRegCount(id) {
          const timestamp = new Date().toISOString();
          console.log(`[${timestamp}] [getRegCount] Getting registration count for Event ID:`, id);

          return new Promise(r => {
            $.ajax({
              url: this.site + "/_api/web/lists/getbytitle('Registrations')/items?$filter=EventLookupId eq " + id + " and Status eq 'Confirmed'&$select=Id",
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
        }

        async checkExistingRegistration(id) {
          const timestamp = new Date().toISOString();
          console.log(`[${timestamp}] [checkExistingRegistration] Checking registration for Event ID:`, id, "User:", this.userEmail);

          return new Promise(resolve => {
            const query = this.site + "/_api/web/lists/getbytitle('Registrations')/items" +
                          "?$filter=EventLookupId eq " + id + " and UserEmail eq '" + encodeURIComponent(this.userEmail) + "'" +
                          "&$select=Id,Status,WaitlistPosition,Title,EventLookupId/Id&$expand=EventLookupId";
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
        }

        async register(id) {
          const timestamp = new Date().toISOString();
          console.log(`[${timestamp}] [register] Attempting registration for Event ID:`, id);

          try {
            if (!Number.isInteger(id) || id <= 0) {
              console.error(`[${timestamp}] [register] Invalid Event ID:`, id);
              alert("Invalid event ID.");
              return;
            }
            console.log(`[${timestamp}] [register] Event ID validated:`, id);

            const ev = this.state.events.find(e => e.Id === id);
            if (!ev) {
              console.error(`[${timestamp}] [register] Event not found for ID:`, id);
              alert("Event not found.");
              return;
            }
            if (!ev.AllowRegistration) {
              console.warn(`[${timestamp}] [register] Registration closed for Event ID:`, id);
              alert("Registration closed.");
              return;
            }
            console.log(`[${timestamp}] [register] Event validated:`, ev.Title);

            console.log(`[${timestamp}] [register] Before loadMyRegs...`);
            const myRegs = await this.loadMyRegs().catch(err => {
              console.error(`[${timestamp}] [register] loadMyRegs failed:`, err);
              throw new Error("Failed to load registrations. Please try again.");
            });
            console.log(`[${timestamp}] [register] After loadMyRegs, registrations:`, myRegs.length);

            const localReg = myRegs.find(r => r.EventLookupId === ev.Id);
            if (localReg) {
              console.log(`[${timestamp}] [register] Found in local state for Event ID ${id}:`, localReg);
              alert("You are already " + (localReg.Status === 'Confirmed' ? "registered" : `waitlisted (#${localReg.WaitlistPosition})`));
              return;
            }
            console.log(`[${timestamp}] [register] No local registration found`);

            console.log(`[${timestamp}] [register] Double-checking via REST...`);
            const existingReg = await this.checkExistingRegistration(id);
            if (existingReg) {
              console.log(`[${timestamp}] [register] Already registered via REST for Event ID ${id}:`, existingReg);
              alert("You are already " + (existingReg.Status === 'Confirmed' ? "registered" : `waitlisted (#${existingReg.WaitlistPosition})`));
              return;
            }
            console.log(`[${timestamp}] [register] No existing registration via REST`);

            console.log(`[${timestamp}] [register] Checking seat availability...`);
            const count = await this.getRegCount(id);
            const full = ev.MaxSeats && count >= ev.MaxSeats;
            console.log(`[${timestamp}] [register] Event ID ${id} - Seats: ${count}/${ev.MaxSeats || 'Unlimited'}, Full: ${full}`);

            console.log(`[${timestamp}] [register] Refreshing digest before registration...`);
            this.digest = await refreshDigest(this.site);
            if (!this.digest) {
              throw new Error("Failed to refresh digest for registration.");
            }

            if (!full) {
              console.log(`[${timestamp}] [register] Creating confirmed registration...`);
              await this.createReg(id, 'Confirmed', null, ev.Title);
            } else {
              const pos = await this.getNextWaitlistPosition(id);
              console.log(`[${timestamp}] [register] Event full. Offering waitlist position:`, pos);
              if (confirm(`Event full. Join waitlist #${pos}?`)) {
                console.log(`[${timestamp}] [register] Creating waitlist registration...`);
                await this.createReg(id, 'Waitlisted', pos, ev.Title);
              } else {
                console.log(`[${timestamp}] [register] User declined waitlist for Event ID:`, id);
                alert("Waitlist registration cancelled.");
              }
            }
          } catch (err) {
            console.error(`[${timestamp}] [register] Unexpected error in registration:`, err);
            handleError("Register", err, "Failed to process registration. Please check permissions or list settings.");
          }
        }

        async createReg(id, status, pos, title, retryCount = 0) {
          const maxRetries = 2;
          const timestamp = new Date().toISOString();
          const registrationDate = new Date().toISOString();
          console.log(`[${timestamp}] [createReg] Creating registration for Event ID:`, id, {
            userEmail: this.userEmail,
            status,
            waitlistPosition: pos,
            title,
            registrationDate,
            retryCount
          });

          try {
            const eventExists = this.state.events.some(e => e.Id === id);
            if (!eventExists) {
              console.error(`[${timestamp}] [createReg] Event ID ${id} does not exist in Events list`);
              throw new Error(`Event ID ${id} not found.`);
            }

            const response = await $.ajax({
              url: this.site + "/_api/web/lists/getbytitle('Registrations')/items",
              type: "POST",
              data: JSON.stringify({
                '__metadata': { type: 'SP.Data.RegistrationsListItem' },
                EventLookupId: id,
                UserEmail: this.userEmail,
                Status: status,
                WaitlistPosition: pos,
                Title: title,
                RegistrationDate: registrationDate
              }),
              headers: {
                Accept: "application/json; odata=verbose",
                "X-RequestDigest": this.digest,
                "Content-Type": "application/json; odata=verbose"
              },
              timeout: 10000
            });
            console.log(`[${timestamp}] [createReg] Registration created successfully for Event ID ${id}:`, response);
            alert(status === 'Confirmed' ? 'Registered successfully!' : `Added to waitlist #${pos}`);
            await this.loadEvents();
            await this.loadMyRegs();
          } catch (xhr) {
            const msg = xhr.responseJSON?.error?.message?.value || "Registration failed";
            console.error(`[${timestamp}] [createReg] Error for Event ID ${id}:`, msg, {
              status: xhr.status,
              statusText: xhr.statusText,
              response: xhr.responseJSON || xhr.responseText
            });

            if (msg.includes("A list item with ID") && retryCount < maxRetries) {
              console.log(`[${timestamp}] [createReg] Duplicate error detected. Retrying (${retryCount + 1}/${maxRetries})...`);
              await this.loadMyRegs();
              const existingReg = await this.checkExistingRegistration(id);
              if (existingReg) {
                console.log(`[${timestamp}] [createReg] Confirmed existing registration on retry:`, existingReg);
                alert("You are already " + (existingReg.Status === 'Confirmed' ? "registered" : `waitlisted (#${existingReg.WaitlistPosition})`));
              } else {
                console.log(`[${timestamp}] [createReg] No existing registration on retry. Attempting again...`);
                await this.createReg(id, status, pos, title, retryCount + 1);
              }
            } else {
              let userMsg = `Failed to register: ${msg}`;
              if (xhr.status === 403) userMsg = "Access denied. Please check your permissions.";
              if (xhr.status === 400) userMsg = "Invalid request. Please check list settings or Event ID.";
              handleError("Create Registration", xhr, userMsg);
            }
          }
        }

        getNextWaitlistPosition(id) {
          const timestamp = new Date().toISOString();
          console.log(`[${timestamp}] [getNextWaitlistPosition] Getting next waitlist position for Event ID:`, id);

          return new Promise(r => {
            $.ajax({
              url: this.site + "/_api/web/lists/getbytitle('Registrations')/items?$filter=EventLookupId eq " + id + " and Status eq 'Waitlisted'&$orderby=WaitlistPosition desc&$top=1&$select=WaitlistPosition",
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
        }

        showUnreg(id) {
          const timestamp = new Date().toISOString();
          console.log(`[${timestamp}] [showUnreg] Showing unregister modal for Event ID:`, id);
          this.setState({ unregId: id });
          $("#unregModal").modal("show");
        }

        async unregister() {
          const timestamp = new Date().toISOString();
          console.log(`[${timestamp}] [unregister] Unregistering for Event ID:`, this.state.unregId);

          const id = this.state.unregId;
          $("#unregModal").modal("hide");

          try {
            console.log(`[${timestamp}] [unregister] Refreshing digest before unregister...`);
            this.digest = await refreshDigest(this.site);
            if (!this.digest) {
              throw new Error("Failed to refresh digest for unregister.");
            }

            const query = this.site + "/_api/web/lists/getbytitle('Registrations')/items" +
                          "?$filter=EventLookupId eq " + id + " and UserEmail eq '" + encodeURIComponent(this.userEmail) + "'" +
                          "&$select=Id,EventLookupId/Id&$expand=EventLookupId";
            console.log(`[${timestamp}] [unregister] Query URL:`, query);

            const response = await $.ajax({
              url: query,
              headers: { Accept: "application/json; odata=verbose" },
              timeout: 5000
            });
            const reg = response.d?.results?.[0];
            if (!reg) {
              console.warn(`[${timestamp}] [unregister] No registration found for Event ID:`, id);
              alert("You are not registered for this event.");
              return;
            }

            console.log(`[${timestamp}] [unregister] Deleting registration ID:`, reg.Id);
            await $.ajax({
              url: this.site + "/_api/web/lists/getbytitle('Registrations')/items(" + reg.Id + ")",
              type: "POST",
              headers: {
                Accept: "application/json; odata=verbose",
                "X-RequestDigest": this.digest,
                "If-Match": "*",
                "X-HTTP-Method": "DELETE"
              },
              timeout: 5000
            });
            console.log(`[${timestamp}] [unregister] Registration deleted successfully for Event ID:`, id);
            await this.loadEvents();
            await this.loadMyRegs();
            console.log(`[${timestamp}] [unregister] UI updated after deletion`);
            alert("Registration cancelled successfully.");
          } catch (xhr) {
            console.error(`[${timestamp}] [unregister] Error unregistering for Event ID ${id}:`, xhr);
            let userMsg = "Failed to cancel registration.";
            if (xhr.status === 403) userMsg = "Access denied. Please check your permissions.";
            if (xhr.status === 404) userMsg = "Registration not found.";
            if (xhr.status === 400) userMsg = "Invalid request. Please check list settings.";
            handleError("Unregister", xhr, userMsg);
          }
        }

        renderCards() {
          const timestamp = new Date().toISOString();
          console.log(`[${timestamp}] [renderCards] Rendering event cards...`);

          if (this.state.loading) {
            console.log(`[${timestamp}] [renderCards] Still loading, skipping render`);
            return;
          }

          const filtered = this.state.events.filter(e =>
            e.Title.toLowerCase().includes(this.state.search) ||
            (e.Room && e.Room.toLowerCase().includes(this.state.search))
          );
          console.log(`[${timestamp}] [renderCards] Filtered events:`, filtered.length);

          const cards = filtered.length ? filtered.map(ev => {
            const myReg = this.state.myRegs.find(r => r.EventLookupId === ev.Id);
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
                React.createElement("button", { className: "btn btn-danger btn-sm", onClick: () => this.showUnreg(ev.Id) }, "Cancel")
              );
            } else {
              btn = React.createElement("div", null,
                React.createElement("button", { className: "btn btn-success btn-sm", onClick: () => this.register(ev.Id) }, isFull ? "Join Waitlist" : "Register"),
                React.createElement("button", { className: "btn btn-info btn-sm", onClick: () => this.refreshMyRegs() }, "Refresh")
              );
            }

            return React.createElement("div", { key: ev.Id, className: "col-md-6 mb-3" },
              React.createElement("div", { className: panelCls },
                React.createElement("div", { className: "panel-heading" }, ev.Title),
                React.createElement("div", { className: "panel-body" },
                  React.createElement("p", null, "Time: ", new Date(ev.StartTime).toLocaleString(), " - ", new Date(ev.EndTime).toLocaleString()),
                  React.createElement("p", null, "Room: ", ev.Room || "TBD"),
                  React.createElement("p", null, "Instructor: ", ev.Instructor?.Title || "TBD"),
                  React.createElement("p", null, "Seats: ", ev.regCount, "/", ev.MaxSeats || "Unlimited")
                ),
                React.createElement("div", { className: "panel-footer text-right" }, btn)
              )
            );
          }) : [React.createElement("div", { key: "no", className: "alert alert-info" }, "No events found.")];

          console.log(`[${timestamp}] [renderCards] Rendering ${cards.length} cards`);
          ReactDOM.render(React.createElement("div", { className: "row" }, cards), document.getElementById("root"));
        }

        render() { return null; }
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
      ReactDOM.render(app, document.getElementById("root"));
      $("#loading").show();
      console.log(`[${timestamp}] [App Init] App rendered, loading shown`);

    } catch (err) {
      handleError("App Init", err, "Failed to initialize app.");
    }
  });
})();