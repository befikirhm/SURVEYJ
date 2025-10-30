// === WAIT FOR SHAREPOINT CONTEXT ===
function waitForSpContext(callback) {
  if (typeof _spPageContextInfo !== 'undefined' && _spPageContextInfo !== null) {
    callback();
  } else {
    const interval = setInterval(() => {
      if (typeof _spPageContextInfo !== 'undefined' && _spPageContextInfo !== null) {
        clearInterval(interval);
        callback();
      }
    }, 100);
  }
}

waitForSpContext(function () {
  $(document).ready(function () {

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
        this.site = _spPageContextInfo.webAbsoluteUrl;
        this.userEmail = _spPageContextInfo.userLoginName;
        this.digest = $("#__REQUESTDIGEST").val();

        if (!this.site || !this.userEmail) {
          alert("Error: SharePoint context missing.");
          return;
        }

        $('#searchBox').on('input', this.handleSearch);

        this.checkAdmin(() => {
          this.loadEvents();
          this.loadMyRegs();
        });
      }

      checkAdmin(cb) {
        $.ajax({
          url: this.site + "/_api/web/currentuser/groups?$filter=Title eq 'Event Managers'",
          headers: { Accept: "application/json; odata=verbose" },
          success: d => {
            const admin = d.d.results.length > 0;
            this.setState({ isAdmin: admin });
            if (admin) this.renderAdminLinks();
            cb();
          },
          error: () => cb()
        });
      }

      renderAdminLinks() {
        const links = React.createElement("div", null,
          React.createElement("a", { href: "AdminDashboard.aspx", className: "btn btn-warning btn-block mb-2" }, "Admin Dashboard"),
          React.createElement("a", { href: "Survey.aspx", className: "btn btn-info btn-block" }, "Design Survey")
        );
        ReactDOM.render(links, document.getElementById("adminLinks"));
      }

      handleSearch(e) {
        this.setState({ search: e.target.value.toLowerCase() }, () => {
          this.renderCards();
        });
      }

      loadEvents() {
        const q = "?$select=Id,Title,StartTime,EndTime,Room,Instructor/Title,MaxSeats,AllowRegistration,IsOver,Attachments&$expand=Instructor";
        $.ajax({
          url: this.site + "/_api/web/lists/getbytitle('Events')/items" + q,
          headers: { Accept: "application/json; odata=verbose" },
          success: d => {
            const evs = (d.d.results || []).sort((a, b) => new Date(a.StartTime) - new Date(b.StartTime));
            Promise.all(evs.map(e => this.getRegCount(e.Id).then(c => ({ ...e, regCount: c }))))
              .then(evs => {
                this.setState({ events: evs, loading: false }, () => {
                  $("#loading").hide();
                  this.renderCards();
                });
              });
          },
          error: () => {
            $("#loading").hide();
            alert("Failed to load events. Check list name 'Events'.");
          }
        });
      }

      loadMyRegs() {
        $.ajax({
          url: this.site + "/_api/web/lists/getbytitle('Registrations')/items?$filter=UserEmail eq '" + this.userEmail + "'&$select=EventLookupId,Status,WaitlistPosition",
          headers: { Accept: "application/json; odata=verbose" },
          success: d => this.setState({ myRegs: d.d.results || [] }),
          error: () => {}
        });
      }

      getRegCount(id) {
        return new Promise(r => {
          $.ajax({
            url: this.site + "/_api/web/lists/getbytitle('Registrations')/items?$filter=EventLookupId eq " + id + " and Status eq 'Confirmed'",
            headers: { Accept: "application/json; odata=verbose" },
            success: d => r(d.d.results.length),
            error: () => r(0)
          });
        });
      }

      register(id) {
        const event = this.state.events.find(e => e.Id === id);
        if (!event || !event.AllowRegistration) return alert("Registration closed");

        this.getRegCount(id).then(count => {
          const isFull = event.MaxSeats && count >= event.MaxSeats;
          if (!isFull) {
            this.createRegistration(id, 'Confirmed', null);
          } else {
            this.getNextWaitlistPosition(id).then(pos => {
              if (confirm(`Event is full. Join waitlist at position ${pos}?`)) {
                this.createRegistration(id, 'Waitlisted', pos);
              }
            });
          }
        });
      }

      createRegistration(eventId, status, position) {
        $.ajax({
          url: this.site + "/_api/web/lists/getbytitle('Registrations')/items",
          type: "POST",
          data: JSON.stringify({
            '__metadata': { type: 'SP.Data.RegistrationsListItem' },
            EventLookupId: eventId,
            UserEmail: this.userEmail,
            Status: status,
            WaitlistPosition: position
          }),
          headers: {
            Accept: "application/json; odata=verbose",
            "X-RequestDigest": this.digest,
            "Content-Type": "application/json; odata=verbose"
          },
          success: () => {
            const msg = status === 'Confirmed' ? 'Registered!' : `Waitlisted at #${position}!`;
            alert(msg);
            this.loadEvents();
            this.loadMyRegs();
          },
          error: e => {
            alert("Error: " + (e.responseJSON?.error?.message?.value || "Unknown"));
          }
        });
      }

      getNextWaitlistPosition(eventId) {
        return new Promise(r => {
          $.ajax({
            url: this.site + "/_api/web/lists/getbytitle('Registrations')/items?$filter=EventLookupId eq " + eventId + " and Status eq 'Waitlisted'&$orderby=WaitlistPosition desc&$top=1&$select=WaitlistPosition",
            headers: { Accept: "application/json; odata=verbose" },
            success: d => r((d.d.results[0]?.WaitlistPosition || 0) + 1),
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
          url: this.site + "/_api/web/lists/getbytitle('Registrations')/items?$filter=EventLookupId eq " + id + " and UserEmail eq '" + this.userEmail + "'",
          headers: { Accept: "application/json; odata=verbose" },
          success: d => {
            if (d.d.results.length) {
              const regId = d.d.results[0].Id;
              $.ajax({
                url: this.site + "/_api/web/lists/getbytitle('Registrations')/items(" + regId + ")",
                type: "POST",
                headers: { "X-RequestDigest": this.digest, "If-Match": "*", "X-HTTP-Method": "DELETE" },
                success: () => {
                  alert("Registration cancelled");
                  this.loadEvents();
                  this.loadMyRegs();
                  this.autoPromoteWaitlist(id);
                }
              });
            }
          }
        });
      }

      autoPromoteWaitlist(eventId) {
        $.ajax({
          url: this.site + "/_api/web/lists/getbytitle('Registrations')/items?$filter=EventLookupId eq " + eventId + " and Status eq 'Waitlisted'&$orderby=WaitlistPosition asc&$top=1&$select=Id",
          headers: { Accept: "application/json; odata=verbose" },
          success: d => {
            if (d.d.results.length) {
              const reg = d.d.results[0];
              $.ajax({
                url: this.site + "/_api/web/lists/getbytitle('Registrations')/items(" + reg.Id + ")",
                type: "POST",
                data: JSON.stringify({ '__metadata': { type: 'SP.Data.RegistrationsListItem' }, Status: 'Confirmed' }),
                headers: { "X-RequestDigest": this.digest, "If-Match": "*", "X-HTTP-Method": "MERGE" },
                success: () => console.log("Auto-promoted waitlist")
              });
            }
          }
        });
      }

      renderCards() {
        const filtered = this.state.events.filter(e =>
          e.Title.toLowerCase().includes(this.state.search) ||
          (e.Room && e.Room.toLowerCase().includes(this.state.search))
        );

        const cards = filtered.length > 0 ? filtered.map(ev => {
          const myReg = this.state.myRegs.find(r => r.EventLookupId === ev.Id);
          const isFull = ev.MaxSeats && ev.regCount >= ev.MaxSeats;
          const isPast = new Date(ev.EndTime) < new Date();
          const canReg = ev.AllowRegistration && !isPast;

          const panelCls = isFull || isPast ? "panel panel-default card-full" + (isPast ? " card-past" : "") : "panel panel-primary";

          let btn;
          if (!canReg) {
            btn = React.createElement("button", { className: "btn btn-default btn-sm disabled" }, isFull ? "Full" : "Closed");
          } else if (myReg) {
            if (myReg.Status === 'Confirmed') {
              btn = React.createElement("button", { className: "btn btn-success btn-sm disabled" }, "Registered");
            } else {
              btn = React.createElement("button", { className: "btn btn-warning btn-sm disabled" }, `Waitlist #${myReg.WaitlistPosition}`);
            }
            btn = React.createElement("div", null, btn,
              React.createElement("button", { className: "btn btn-danger btn-sm", onClick: () => this.showUnreg(ev.Id) }, "Cancel")
            );
          } else {
            btn = React.createElement("button", { className: "btn btn-success btn-sm", onClick: () => this.register(ev.Id) },
              isFull ? "Join Waitlist" : "Register"
            );
          }

          const attachments = ev.Attachments
            ? React.createElement("a", { href: this.site + "/_api/web/lists/getbytitle('Events')/items(" + ev.Id + ")/AttachmentFiles", target: "_blank", className: "btn btn-link btn-xs" }, "Resources")
            : null;

          return React.createElement("div", { key: ev.Id, className: "col-md-6 mb-3" },
            React.createElement("div", { className: panelCls },
              React.createElement("div", { className: "panel-heading" }, ev.Title),
              React.createElement("div", { className: "panel-body" },
                React.createElement("p", null, "Time: ", new Date(ev.StartTime).toLocaleString(), " - ", new Date(ev.EndTime).toLocaleString()),
                React.createElement("p", null, "Room: ", ev.Room || "TBD"),
                React.createElement("p", null, "Instructor: ", ev.Instructor ? ev.Instructor.Title : "TBD"),
                React.createElement("p", null, "Seats: ", ev.regCount, "/", ev.MaxSeats || "Unlimited"),
                myReg && myReg.Status === 'Waitlisted' ? React.createElement("p", { className: "text-warning" }, "Waitlist #", myReg.WaitlistPosition) : null,
                attachments
              ),
              React.createElement("div", { className: "panel-footer text-right" }, btn)
            )
          );
        }) : [React.createElement("div", { key: "no", className: "alert alert-info" }, "No events found.")];

        ReactDOM.render(React.createElement("div", { className: "row" }, cards), document.getElementById("root"));
      }

      render() {
        if (this.state.loading) {
          return null;
        }
        return null;
      }
    }

    $(document).on('click', '#confirmUnreg', function () {
      appInstance && appInstance.unregister();
    });

    const app = React.createElement(App);
    ReactDOM.render(app, document.getElementById("root"));
    appInstance = app;

    $("#loading").show();
  });
});