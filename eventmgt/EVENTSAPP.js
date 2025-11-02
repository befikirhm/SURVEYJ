// === SP 2016 ON-PREM – FIXED DUPLICATE REGISTRATION + EVENTLOOKUP EXPANSION ===
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

  // === GET CONTEXT ===
  async function getContext() {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [getContext] Starting context load...`);

    return new Promise(async (resolve) => {
      let site = '';
      let userEmail = '';
      let digest = '';

      // 1. SITE URL
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

      // 2. USER EMAIL
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

      // 3. DIGEST
      try {
        console.log(`[${timestamp}] [getContext] Fetching digest...`);
        digest = $("#FormDigest1").val() || $("#__REQUESTDIGEST").val() || '';
        if (!digest) {
          console.warn(`[${timestamp}] [getContext] FormDigest1 not found, trying contextinfo...`);
          const resp = await $.ajax({
            url: site + "/_api/contextinfo",
            method: "POST",
            headers: { Accept: "application/json; odata=verbose" }
          });
          digest = resp.d.GetContextWebInformation.FormDigestValue;
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
        }

        componentDidMount() {
          const timestamp = new Date().toISOString();
          console.log(`[${timestamp}] [componentDidMount] Initializing component...`);
          this.site = ctx.site;
          this.userEmail = ctx.userEmail;
          this.digest = ctx.digest;

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

          return new Promise(resolve => {
            $.ajax({
              url: this.site + "/_api/web/lists/getbytitle('Registrations')/items?$filter=UserEmail eq '" + encodeURIComponent(this.userEmail) + "'&$select=Id,EventLookupId,Status,WaitlistPosition,EventTitle,RegistrationDate,EventLookup/Id,EventLookup/Title&$expand=EventLookup",
              headers: { Accept: "application/json; odata=verbose" },
              success: d => {
                const registrations = (d.d?.results || []).map(r => ({
                  Id: r.Id,
                  EventLookupId: r.EventLookup?.Id || r.EventLookupId,
                  EventTitle: r.EventLookup?.Title || r.EventTitle,
                  Status: r.Status,
                  WaitlistPosition: r.WaitlistPosition,
                  RegistrationDate: r.RegistrationDate
                }));
                console.log(`[${timestamp}] [loadMyRegs] My registrations loaded:`, registrations.length, registrations);
                this.setState({ myRegs: registrations }, () => {
                  this.renderCards();
                  resolve(true);
                });
              },
              error: xhr => {
                console.warn(`[${timestamp}] [loadMyRegs] Failed to load registrations:`, xhr);
                this.setState({ myRegs: [] }, () => {
                  this.renderCards();
                  resolve(false);
                });
              }
            });
          });
        }

        getRegCount(id) {
          const timestamp = new Date().toISOString();
          console.log(`[${timestamp}] [getRegCount] Getting registration count for Event ID:`, id);

          return new Promise(r => {
            $.ajax({
              url: this.site + "/_api/web/lists/getbytitle('Registrations')/items?$filter=EventLookupId eq " + id + " and Status eq 'Confirmed'&$select=Id",
              headers: { Accept: "application/json; odata=verbose" },
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
            $.ajax({
              url: this.site + "/_api/web/lists/getbytitle('Registrations')/items?$filter=EventLookupId eq " + id + " and UserEmail eq '" + encodeURIComponent(this.userEmail) + "'&$select=Id,Status,WaitlistPosition,EventLookup/Id,EventLookup/Title&$expand=EventLookup",
              headers: { Accept: "application/json; odata=verbose" },
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

          // Validate Event ID
          if (!Number.isInteger(id) || id <= 0) {
            console.error(`[${timestamp}] [register] Invalid Event ID:`, id);
            alert("Invalid event ID.");
            return;
          }

          const ev = this.state.events.find(e => e.Id === id);
          if (!ev || !ev.AllowRegistration) {
            console.warn(`[${timestamp}] [register] Registration closed for Event ID:`, id);
            alert("Registration closed");
            return;
          }

          // Force refresh myRegs
          console.log(`[${timestamp}] [register] Refreshing my registrations...`);
          await this.loadMyRegs();

          // Check local state
          const localReg = this.state.myRegs.find(r => r.EventLookupId === ev.Id);
          if (localReg) {
            console.log(`[${timestamp}] [register] Found in local state for Event ID ${id}:`, localReg);
            alert("You are already " + (localReg.Status === 'Confirmed' ? "registered" : `waitlisted (#${localReg.WaitlistPosition})`));
            return;
          }

          // Double-check with REST
          console.log(`[${timestamp}] [register] Double-checking via REST...`);
          const existingReg = await this.checkExistingRegistration(id);
          if (existingReg) {
            console.log(`[${timestamp}] [register] Already registered via REST for Event ID ${id}:`, existingReg);
            alert("You are already " + (existingReg.Status === 'Confirmed' ? "registered" : `waitlisted (#${existingReg.WaitlistPosition})`));
            return;
          }

          console.log(`[${timestamp}] [register] No existing registration. Checking seat availability...`);
          this.getRegCount(id).then(count => {
            const full = ev.MaxSeats && count >= ev.MaxSeats;
            console.log(`[${timestamp}] [register] Event ID ${id} - Seats: ${count}/${ev.MaxSeats || 'Unlimited'}, Full: ${full}`);
            if (!full) {
              console.log(`[${timestamp}] [register] Creating confirmed registration...`);
              this.createReg(id, 'Confirmed', null, ev.Title);
            } else {
              this.getNextWaitlistPosition(id).then(pos => {
                console.log(`[${timestamp}] [register] Event full. Offering waitlist position:`, pos);
                if (confirm(`Event full. Join waitlist #${pos}?`)) {
                  console.log(`[${timestamp}] [register] Creating waitlist registration...`);
                  this.createReg(id, 'Waitlisted', pos, ev.Title);
                } else {
                  console.log(`[${timestamp}] [register] User declined waitlist for Event ID:`, id);
                }
              });
            }
          });
        }

        createReg(id, status, pos, eventTitle, retryCount = 0) {
          const maxRetries = 2;
          const timestamp = new Date().toISOString();
          const registrationDate = new Date().toISOString();
          console.log(`[${timestamp}] [createReg] Creating registration for Event ID:`, id, {
            userEmail: this.userEmail,
            status,
            waitlistPosition: pos,
            eventTitle,
            registrationDate,
            retryCount
          });

          $.ajax({
            url: this.site + "/_api/web/lists/getbytitle('Registrations')/items",
            type: "POST",
            data: JSON.stringify({
              '__metadata': { type: 'SP.Data.RegistrationsListItem' },
              EventLookupId: { Id: id },
              UserEmail: this.userEmail,
              Status: status,
              WaitlistPosition: pos,
              EventTitle: eventTitle,
              RegistrationDate: registrationDate
            }),
            headers: {
              Accept: "application/json; odata=verbose",
              "X-RequestDigest": this.digest,
              "Content-Type": "application/json; odata=verbose"
            },
            success: () => {
              console.log(`[${timestamp}] [createReg] Registration created successfully for Event ID:`, id);
              alert(status === 'Confirmed' ? 'Registered!' : `Waitlist #${pos}`);
              this.loadEvents();
              this.loadMyRegs();
            },
            error: xhr => {
              const msg = xhr.responseJSON?.error?.message?.value || "Registration failed";
              console.error(`[${timestamp}] [createReg] Error for Event ID ${id}:`, msg);

              if (msg.includes("A list item with ID") && retryCount < maxRetries) {
                console.log(`[${timestamp}] [createReg] Duplicate error detected. Retrying (${retryCount + 1}/${maxRetries})...`);
                this.loadMyRegs().then(() => {
                  this.checkExistingRegistration(id).then(existingReg => {
                    if (existingReg) {
                      console.log(`[${timestamp}] [createReg] Confirmed existing registration on retry:`, existingReg);
                      alert("You are already " + (existingReg.Status === 'Confirmed' ? "registered" : `waitlisted (#${existingReg.WaitlistPosition})`));
                    } else {
                      console.log(`[${timestamp}] [createReg] No existing registration on retry. Attempting again...`);
                      this.createReg(id, status, pos, eventTitle, retryCount + 1);
                    }
                  });
                });
              } else {
                handleError("Create Registration", xhr, `Failed to register: ${msg}`);
              }
            }
          });
        }

        getNextWaitlistPosition(id) {
          const timestamp = new Date().toISOString();
          console.log(`[${timestamp}] [getNextWaitlistPosition] Getting next waitlist position for Event ID:`, id);

          return new Promise(r => {
            $.ajax({
              url: this.site + "/_api/web/lists/getbytitle('Registrations')/items?$filter=EventLookupId eq " + id + " and Status eq 'Waitlisted'&$orderby=WaitlistPosition desc&$top=1&$select=WaitlistPosition",
              headers: { Accept: "application/json; odata=verbose" },
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

        unregister() {
          const timestamp = new Date().toISOString();
          console.log(`[${timestamp}] [unregister] Unregistering for Event ID:`, this.state.unregId);

          const id = this.state.unregId;
          $("#unregModal").modal("hide");

          $.ajax({
            url: this.site + "/_api/web/lists/getbytitle('Registrations')/items?$filter=EventLookupId eq " + id + " and UserEmail eq '" + encodeURIComponent(this.userEmail) + "'",
            headers: { Accept: "application/json; odata=verbose" },
            success: d => {
              const reg = d.d?.results?.[0];
              if (!reg) {
                console.warn(`[${timestamp}] [unregister] No registration found for Event ID:`, id);
                alert("Not registered.");
                return;
              }

              console.log(`[${timestamp}] [unregister] Deleting registration ID:`, reg.Id);
              $.ajax({
                url: this.site + "/_api/web/lists/getbytitle('Registrations')/items(" + reg.Id + ")",
                type: "POST",
                headers: { "X-RequestDigest": this.digest, "If-Match": "*", "X-HTTP-Method": "DELETE" },
                success: () => {
                  console.log(`[${timestamp}] [unregister] Registration deleted for Event ID:`, id);
                  alert("Cancelled");
                  this.loadEvents();
                  this.loadMyRegs();
                },
                error: xhr => {
                  handleError("Unregister", xhr, "Failed to cancel registration.");
                }
              });
            },
            error: xhr => {
              handleError("Find Registration to Unregister", xhr, "Failed to find registration to cancel.");
            }
          });
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
              btn = React.createElement("button", { className: "btn btn-success btn-sm", onClick: () => this.register(ev.Id) },
                isFull ? "Join Waitlist" : "Register"
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
        appInstance?.unregister();
      });

      const app = React.createElement(App);
      ReactDOM.render(app, document.getElementById("root"));
      appInstance = app;
      $("#loading").show();
      console.log(`[${timestamp}] [App Init] App rendered, loading shown`);

    } catch (err) {
      handleError("App Init", err, "Failed to initialize app.");
    }
  });
})();