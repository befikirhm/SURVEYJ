// === SP 2016 ON-PREM – CORRECT FIELD NAMES ===
(function () {
  'use strict';

  // === ERROR HANDLER ===
  function handleError(step, error, userMsg = "An error occurred.") {
    console.error(`[ERROR] ${step}:`, error);
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
    return new Promise(async (resolve) => {
      let site = '';
      let userEmail = '';
      let digest = '';

      // 1. SITE URL
      try {
        if (typeof _spPageContextInfo !== 'undefined' && _spPageContextInfo?.webAbsoluteUrl) {
          site = _spPageContextInfo.webAbsoluteUrl.replace(/\/$/, '');
        } else {
          const path = window.location.pathname;
          const match = path.match(/\/sites\/[^\/]+|\/[^\/]+/);
          site = window.location.origin + (match ? match[0] : '');
        }
        console.log("Site URL:", site);
      } catch (e) {
        return handleError("Site URL", e);
      }

      // 2. USER EMAIL
      try {
        const userResp = await $.ajax({
          url: site + "/_api/web/currentuser",
          headers: { Accept: "application/json; odata=verbose" },
          timeout: 10000
        });
        userEmail = userResp.d.Email || userResp.d.LoginName;
        console.log("User Email:", userEmail);
      } catch (e) {
        userEmail = _spPageContextInfo?.userLoginName || 'unknown';
      }

      // 3. DIGEST
      digest = $("#FormDigest1").val() || $("#__REQUESTDIGEST").val() || '';
      if (!digest) {
        try {
          const resp = await $.ajax({
            url: site + "/_api/contextinfo",
            method: "POST",
            headers: { Accept: "application/json; odata=verbose" }
          });
          digest = resp.d.GetContextWebInformation.FormDigestValue;
        } catch (e) {
          return handleError("Digest", e);
        }
      }
      console.log("Digest loaded");

      if (!site || !userEmail || !digest) {
        return handleError("Context", "Missing site, user, or digest");
      }

      resolve({ site, userEmail, digest });
    });
  }

  // === MAIN APP ===
  $(document).ready(async function () {
    console.log("DOM Ready. Initializing...");

    let appInstance = null;

    try {
      const ctx = await getContext();
      if (!ctx) return;

      console.log("FULL CONTEXT READY");

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
          this.site = ctx.site;
          this.userEmail = ctx.userEmail;
          this.digest = ctx.digest;

          $('#searchBox').on('input', this.handleSearch);
          this.checkAdmin(() => {
            console.log("Admin check done. Loading events...");
            this.loadEvents();
            this.loadMyRegs();
          });
        }

        checkAdmin(cb) {
          $.ajax({
            url: this.site + "/_api/web/currentuser/groups?$filter=Title eq 'Event Managers'",
            headers: { Accept: "application/json; odata=verbose" },
            success: d => {
              try {
                const isAdmin = d.d?.results?.length > 0;
                this.setState({ isAdmin });
                if (isAdmin) this.renderAdminLinks();
              } catch (e) { console.warn("Admin error:", e); }
              cb();
            },
            error: () => cb()
          });
        }

        renderAdminLinks() {
          try {
            const links = React.createElement("div", null,
              React.createElement("a", { href: "AdminDashboard.aspx", className: "btn btn-warning btn-block mb-2" }, "Admin Dashboard"),
              React.createElement("a", { href: "Survey.aspx", className: "btn btn-info btn-block" }, "Design Survey")
            );
            ReactDOM.render(links, document.getElementById("adminLinks"));
          } catch (e) { console.error("Links failed:", e); }
        }

        handleSearch(e) {
          this.setState({ search: e.target.value.toLowerCase() }, () => {
            if (!this.state.loading) this.renderCards();
          });
        }

        // === LOAD EVENTS WITH CORRECT FIELDS ===
        loadEvents() {
          console.log("loadEvents() STARTED");

          // FIELD MAPPING:
          // StartDate → StartTime
          // EndDate → EndTime
          // Location → Room
          // Instructor → Single Line Text
          const q = "?$select=Id,Title,StartDate,EndDate,Location,Instructor,MaxSeats,AllowRegistration,IsOver,Attachments";
          const url = this.site + "/_api/web/lists/getbytitle('Events')/items" + q;

          $.ajax({
            url,
            headers: { Accept: "application/json; odata=verbose" },
            timeout: 15000,
            success: d => {
              console.log("Events loaded:", d.d?.results?.length || 0);

              try {
                let evs = (d.d?.results || []).map(ev => ({
                  Id: ev.Id,
                  Title: ev.Title,
                  StartTime: ev.StartDate,   // MAP
                  EndTime: ev.EndDate,       // MAP
                  Room: ev.Location,         // MAP
                  Instructor: { Title: ev.Instructor }, // MAP to object
                  MaxSeats: ev.MaxSeats,
                  AllowRegistration: ev.AllowRegistration,
                  IsOver: ev.IsOver,
                  Attachments: ev.Attachments,
                  regCount: 0
                })).sort((a, b) => new Date(a.StartTime) - new Date(b.EndTime));

                if (evs.length === 0) {
                  this.setState({ events: [], loading: false }, () => {
                    $("#loading").hide();
                    this.renderCards();
                  });
                  return;
                }

                Promise.all(evs.map(e => this.getRegCount(e.Id).then(c => ({ ...e, regCount: c }))))
                  .then(processed => {
                    this.setState({ events: processed, loading: false }, () => {
                      $("#loading").hide();
                      this.renderCards();
                    });
                  })
                  .catch(() => {
                    this.setState({ events: evs.map(e => ({ ...e, regCount: 0 })), loading: false }, () => {
                      $("#loading").hide();
                      this.renderCards();
                    });
                  });
              } catch (err) {
                handleError("Parse Events", err);
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
          $.ajax({
            url: this.site + "/_api/web/lists/getbytitle('Registrations')/items?$filter=UserEmail eq '" + encodeURIComponent(this.userEmail) + "'&$select=EventLookupId,Status,WaitlistPosition",
            headers: { Accept: "application/json; odata=verbose" },
            success: d => this.setState({ myRegs: d.d?.results || [] }),
            error: () => console.log("My regs failed")
          });
        }

        getRegCount(id) {
          return new Promise(r => {
            $.ajax({
              url: this.site + "/_api/web/lists/getbytitle('Registrations')/items?$filter=EventLookupId eq " + id + " and Status eq 'Confirmed'&$select=Id",
              headers: { Accept: "application/json; odata=verbose" },
              success: d => r(d.d?.results?.length || 0),
              error: () => r(0)
            });
          });
        }

        register(id) {
          const ev = this.state.events.find(e => e.Id === id);
          if (!ev || !ev.AllowRegistration) return alert("Registration closed");

          this.getRegCount(id).then(count => {
            const full = ev.MaxSeats && count >= ev.MaxSeats;
            if (!full) this.createReg(id, 'Confirmed', null);
            else this.getNextWaitlistPosition(id).then(pos => {
              if (confirm(`Event full. Join waitlist #${pos}?`)) this.createReg(id, 'Waitlisted', pos);
            });
          });
        }

        createReg(id, status, pos) {
          $.ajax({
            url: this.site + "/_api/web/lists/getbytitle('Registrations')/items",
            type: "POST",
            data: JSON.stringify({
              '__metadata': { type: 'SP.Data.RegistrationsListItem' },
              EventLookupId: id,
              UserEmail: this.userEmail,
              Status: status,
              WaitlistPosition: pos
            }),
            headers: {
              Accept: "application/json; odata=verbose",
              "X-RequestDigest": this.digest,
              "Content-Type": "application/json; odata=verbose"
            },
            success: () => {
              alert(status === 'Confirmed' ? 'Registered!' : `Waitlist #${pos}`);
              this.loadEvents();
              this.loadMyRegs();
            },
            error: xhr => {
              const msg = xhr.responseJSON?.error?.message?.value || "Try again";
              alert("Registration failed: " + msg);
            }
          });
        }

        getNextWaitlistPosition(id) {
          return new Promise(r => {
            $.ajax({
              url: this.site + "/_api/web/lists/getbytitle('Registrations')/items?$filter=EventLookupId eq " + id + " and Status eq 'Waitlisted'&$orderby=WaitlistPosition desc&$top=1&$select=WaitlistPosition",
              headers: { Accept: "application/json; odata=verbose" },
              success: d => r((d.d?.results?.[0]?.WaitlistPosition || 0) + 1),
              error: () => r(1)
            });
          });
        }

        showUnreg(id) {
          this.setState({ unregId: id });
          $("#unregModal").modal("show");
        }

        unregister() {
          const id = this.state.unregId;
          $("#unregModal").modal("hide");

          $.ajax({
            url: this.site + "/_api/web/lists/getbytitle('Registrations')/items?$filter=EventLookupId eq " + id + " and UserEmail eq '" + encodeURIComponent(this.userEmail) + "'",
            headers: { Accept: "application/json; odata=verbose" },
            success: d => {
              const reg = d.d?.results?.[0];
              if (!reg) return alert("Not registered.");

              $.ajax({
                url: this.site + "/_api/web/lists/getbytitle('Registrations')/items(" + reg.Id + ")",
                type: "POST",
                headers: { "X-RequestDigest": this.digest, "If-Match": "*", "X-HTTP-METHOD": "DELETE" },
                success: () => {
                  alert("Cancelled");
                  this.loadEvents();
                  this.loadMyRegs();
                },
                error: () => alert("Failed to cancel")
              });
            }
          });
        }

        renderCards() {
          if (this.state.loading) return;

          const filtered = this.state.events.filter(e =>
            e.Title.toLowerCase().includes(this.state.search) ||
            (e.Room && e.Room.toLowerCase().includes(this.state.search))
          );

          const cards = filtered.length ? filtered.map(ev => {
            const myReg = this.state.myRegs.find(r => r.EventLookupId === ev.Id);
            const isFull = ev.MaxSeats && ev.regCount >= ev.MaxSeats;
            const isPast = new Date(ev.EndTime) < new Date();
            const canReg = ev.AllowRegistration && !isPast;

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

          ReactDOM.render(React.createElement("div", { className: "row" }, cards), document.getElementById("root"));
        }

        render() { return null; }
      }

      $(document).on('click', '#confirmUnreg', () => appInstance?.unregister());

      const app = React.createElement(App);
      ReactDOM.render(app, document.getElementById("root"));
      appInstance = app;
      $("#loading").show();

    } catch (err) {
      handleError("App Init", err);
    }
  });
})();