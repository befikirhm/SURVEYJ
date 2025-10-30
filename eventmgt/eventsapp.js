// === SAFE SP SCRIPT LOADER + FALLBACK ===
(function () {
  'use strict';

  // === ERROR HANDLER ===
  function handleError(step, error, userMsg = "An error occurred.") {
    console.error(`[ERROR] ${step}:`, error);
    $("#loading").hide();
    alert(`${userMsg}\n\nCheck browser console (F12).`);
  }

  // === LOAD SP.js SAFELY ===
  function ensureSP(callback) {
    if (typeof SP !== 'undefined' && SP.ClientContext) {
      console.log("SP.js already loaded");
      return callback();
    }

    if (typeof _spPageContextInfo !== 'undefined') {
      console.log("_spPageContextInfo available, skipping SP.js load");
      return callback();
    }

    console.log("Loading SP.js via SOD...");
    SP.SOD.executeFunc('sp.js', 'SP.ClientContext', function () {
      console.log("SP.js loaded successfully");
      callback();
    });

    // Fallback timeout
    setTimeout(() => {
      if (typeof SP === 'undefined') {
        console.warn("SP.js failed to load in time");
        callback();
      }
    }, 10000);
  }

  // === GET SP CONTEXT (SAFE) ===
  function getSpContext() {
    return new Promise((resolve) => {
      // 1. Try _spPageContextInfo first
      if (typeof _spPageContextInfo !== 'undefined' && _spPageContextInfo) {
        resolve({
          site: _spPageContextInfo.webAbsoluteUrl,
          user: _spPageContextInfo.userLoginName,
          digest: $("#__REQUESTDIGEST").val()
        });
        return;
      }

      // 2. Fallback to SP.ClientContext
      if (typeof SP !== 'undefined') {
        const ctx = SP.ClientContext.get_current();
        const web = ctx.get_web();
        const user = ctx.get_web().get_currentUser();
        ctx.load(web);
        ctx.load(user);
        ctx.executeQueryAsync(
          () => {
            resolve({
              site: web.get_url(),
              user: user.get_email() || user.get_loginName(),
              digest: $("#__REQUESTDIGEST").val()
            });
          },
          (sender, args) => {
            console.warn("SP.ClientContext failed:", args.get_message());
            resolve(null);
          }
        );
      } else {
        resolve(null);
      }
    });
  }

  // === MAIN APP ===
  $(document).ready(function () {
    console.log("DOM Ready. Ensuring SP.js...");

    ensureSP(function () {
      console.log("SP ready. Starting app...");

      let appInstance = null;

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

        async componentDidMount() {
          console.log("App mounted. Getting context...");

          const ctx = await getSpContext();
          if (!ctx || !ctx.site || !ctx.user || !ctx.digest) {
            handleError("SP Context", "Missing site, user, or digest", "Cannot connect to SharePoint.");
            return;
          }

          this.site = ctx.site;
          this.userEmail = ctx.user;
          this.digest = ctx.digest;

          console.log("SP Context loaded:", { site: this.site, user: this.userEmail });

          $('#searchBox').on('input', this.handleSearch);

          this.checkAdmin(() => {
            console.log("Admin check complete. Starting loadEvents()...");
            this.loadEvents();  // GUARANTEED
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
              } catch (e) { console.warn("Admin parse error:", e); }
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
          } catch (e) { console.error("Admin links failed:", e); }
        }

        handleSearch(e) {
          this.setState({ search: e.target.value.toLowerCase() }, () => {
            if (!this.state.loading) this.renderCards();
          });
        }

        loadEvents() {
          console.log("loadEvents() STARTED");

          const q = "?$select=Id,Title,StartTime,EndTime,Room,Instructor/Title,MaxSeats,AllowRegistration,IsOver,Attachments&$expand=Instructor";
          const url = this.site + "/_api/web/lists/getbytitle('Events')/items" + q;

          $.ajax({
            url,
            headers: { Accept: "application/json; odata=verbose" },
            timeout: 15000,
            success: d => {
              console.log("Events API success:", d.d?.results?.length || 0);

              try {
                let evs = (d.d?.results || []).sort((a, b) => new Date(a.StartTime) - new Date(b.StartTime));

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
          if (!ev || !ev.AllowRegistration) return alert("Closed");

          this.getRegCount(id).then(count => {
            const full = ev.MaxSeats && count >= ev.MaxSeats;
            if (!full) this.createReg(id, 'Confirmed', null);
            else this.getNextWaitlistPosition(id).then(pos => {
              if (confirm(`Full. Join waitlist #${pos}?`)) this.createReg(id, 'Waitlisted', pos);
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
            error: xhr => alert("Error: " + (xhr.responseJSON?.error?.message?.value || "Try again"))
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
                }
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

      try {
        const app = React.createElement(App);
        ReactDOM.render(app, document.getElementById("root"));
        appInstance = app;
        $("#loading").show();
        console.log("App rendered. Waiting for data...");
      } catch (err) {
        handleError("App Start", err);
      }
    });
  });
})();