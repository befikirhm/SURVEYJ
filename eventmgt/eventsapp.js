// === IMMEDIATE EXECUTION – NO WAIT FOR _spPageContextInfo ===
(function () {
  'use strict';

  // === GLOBAL ERROR HANDLER ===
  function handleError(step, error, userMsg = "An error occurred.") {
    console.error(`[ERROR] ${step}:`, error);
    $("#loading").hide();
    alert(`${userMsg}\n\nCheck browser console (F12).`);
  }

  // === GET SP CONTEXT SAFELY ===
  function getSpContext() {
    try {
      if (typeof _spPageContextInfo !== 'undefined' && _spPageContextInfo) {
        return {
          site: _spPageContextInfo.webAbsoluteUrl,
          user: _spPageContextInfo.userLoginName,
          digest: $("#__REQUESTDIGEST").val()
        };
      }

      // Fallback: Use SP.ClientContext
      const ctx = SP.ClientContext.get_current();
      if (ctx) {
        const web = ctx.get_web();
        const user = ctx.get_web().get_currentUser();
        ctx.load(web);
        ctx.load(user);
        return new Promise((resolve, reject) => {
          ctx.executeQueryAsync(
            () => resolve({
              site: web.get_url(),
              user: user.get_email() || user.get_loginName(),
              digest: $("#__REQUESTDIGEST").val()
            }),
            (sender, args) => reject(args.get_message())
          );
        });
      }

      throw new Error("No SP context available");
    } catch (err) {
      throw new Error("SP Context unavailable: " + err.message);
    }
  }

  // === MAIN APP ===
  $(document).ready(function () {
    console.log("DOM Ready. Starting app...");

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

      componentDidMount() {
        console.log("App mounted. Getting SP context...");

        // === GET CONTEXT & START LOADING ===
        Promise.resolve()
          .then(() => getSpContext())
          .then(ctx => {
            this.site = ctx.site;
            this.userEmail = ctx.user;
            this.digest = ctx.digest;

            console.log("SP Context loaded:", { site: this.site, user: this.userEmail });

            $('#searchBox').on('input', this.handleSearch);
            this.checkAdmin(() => {
              console.log("Admin check done. Calling loadEvents() NOW.");
              this.loadEvents();  // GUARANTEED CALL
              this.loadMyRegs();
            });
          })
          .catch(err => {
            handleError("SP Context", err, "Cannot connect to SharePoint.");
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
          error: () => cb() // Always continue
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

      // === loadEvents() – NOW ALWAYS RUNS ===
      loadEvents() {
        console.log("loadEvents() EXECUTED");

        const q = "?$select=Id,Title,StartTime,EndTime,Room,Instructor/Title,MaxSeats,AllowRegistration,IsOver,Attachments&$expand=Instructor";
        const url = this.site + "/_api/web/lists/getbytitle('Events')/items" + q;

        $.ajax({
          url: url,
          headers: { Accept: "application/json; odata=verbose" },
          timeout: 15000,
          success: d => {
            console.log("Events loaded:", d.d?.results?.length || 0, "items");

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
                  // Fallback: show events without count
                  this.setState({ events: evs.map(e => ({ ...e, regCount: 0 })), loading: false }, () => {
                    $("#loading").hide();
                    this.renderCards();
                  });
                });
            } catch (err) {
              handleError("Parse Events", err);
            }
          },
          error: (xhr) => {
            let msg = "Failed to load events.";
            if (xhr.status === 404) msg = "List 'Events' not found.";
            if (xhr.status === 403) msg = "Access denied.";
            handleError("Load Events API", xhr, msg);
          }
        });
      }

      loadMyRegs() {
        const url = this.site + "/_api/web/lists/getbytitle('Registrations')/items?$filter=UserEmail eq '" + encodeURIComponent(this.userEmail) + "'&$select=EventLookupId,Status,WaitlistPosition";
        $.ajax({
          url,
          headers: { Accept: "application/json; odata=verbose" },
          success: d => this.setState({ myRegs: d.d?.results || [] }),
          error: () => console.log("My regs failed (non-critical)")
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

    // === START APP ===
    $(document).on('click', '#confirmUnreg', () => appInstance?.unregister());

    try {
      const app = React.createElement(App);
      ReactDOM.render(app, document.getElementById("root"));
      appInstance = app;
      $("#loading").show();
      console.log("App started. Waiting for SP context...");
    } catch (err) {
      handleError("App Start", err);
    }
  });
})();