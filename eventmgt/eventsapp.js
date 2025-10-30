$(document).ready(function () {
  const { createClass, createElement: h } = React;

  const App = createClass({
    getInitialState: function () {
      return {
        events: [], myRegs: [], isAdmin: false, search: '', loading: false, unregId: null
      };
    },

    componentDidMount: function () {
      this.site = _spPageContextInfo.webAbsoluteUrl;
      this.userEmail = _spPageContextInfo.userLoginName;
      this.digest = $("#__REQUESTDIGEST").val();

      $('#searchBox').on('input', e => this.setState({ search: e.target.value.toLowerCase() }));
      this.checkAdmin(() => {
        this.loadEvents();
        this.loadMyRegs();
      });
    },

    checkAdmin: function (cb) {
      $.ajax({
        url: this.site + "/_api/web/currentuser/groups?$filter=Title eq 'Event Managers'",
        headers: { Accept: "application/json; odata=verbose" },
        success: d => {
          const admin = d.d.results.length > 0;
          this.setState({ isAdmin: admin });
          if (admin) this.renderAdminLinks();
          cb();
        }
      });
    },

    renderAdminLinks: function () {
      const links = h("div", null,
        h("a", { href: "AdminDashboard.aspx", className: "btn btn-warning btn-block mb-2" }, "Admin Dashboard"),
        h("a", { href: "Survey.aspx", className: "btn btn-info btn-block" }, "Design Survey")
      );
      ReactDOM.render(links, document.getElementById("adminLinks"));
    },

    loadEvents: function () {
      this.setState({ loading: true });
      $("#loading").show();

      const q = "?$select=Id,Title,StartTime,EndTime,Room,Instructor/Title,MaxSeats,AllowRegistration,IsOver,Attachments&$expand=Instructor";
      $.ajax({
        url: this.site + "/_api/web/lists/getbytitle('Events')/items" + q,
        headers: { Accept: "application/json; odata=verbose" },
        success: d => {
          const evs = d.d.results.sort((a, b) => new Date(a.StartTime) - new Date(b.StartTime));
          Promise.all(evs.map(e => this.getRegCount(e.Id).then(c => ({ ...e, regCount: c }))))
            .then(evs => {
              this.setState({ events: evs, loading: false }, () => {
                $("#loading").hide();
                this.renderCalendar(evs);
                this.renderCards(evs);
              });
            });
        }
      });
    },

    loadMyRegs: function () {
      $.ajax({
        url: this.site + "/_api/web/lists/getbytitle('Registrations')/items?$filter=UserEmail eq '" + this.userEmail + "'&$select=EventLookupId,Status,WaitlistPosition",
        headers: { Accept: "application/json; odata=verbose" },
        success: d => this.setState({ myRegs: d.d.results })
      });
    },

    getRegCount: function (id) {
      return new Promise(r => {
        $.ajax({
          url: this.site + "/_api/web/lists/getbytitle('Registrations')/items?$filter=EventLookupId eq " + id + " and Status eq 'Confirmed'",
          headers: { Accept: "application/json; odata=verbose" },
          success: d => r(d.d.results.length),
          error: () => r(0)
        });
      });
    },

    // === WAITLIST REGISTRATION ===
    register: function (id) {
      this.setState({ loading: true });
      const event = this.state.events.find(e => e.Id === id);
      if (!event.AllowRegistration) return alert("Registration closed");

      this.getRegCount(id).then(count => {
        const isFull = event.MaxSeats && count >= event.MaxSeats;

        if (!isFull) {
          // CONFIRMED
          this.createRegistration(id, 'Confirmed', null);
        } else {
          // WAITLISTED
          this.getNextWaitlistPosition(id).then(pos => {
            if (window.confirm(`Event is full. Join waitlist at position ${pos}?`)) {
              this.createRegistration(id, 'Waitlisted', pos);
            } else {
              this.setState({ loading: false });
            }
          });
        }
      });
    },

    createRegistration: function (eventId, status, position) {
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
          alert(msg + " Confirmation email sent.");
          this.loadEvents(); this.loadMyRegs();
        },
        error: e => { alert("Error: " + e.responseText); this.setState({ loading: false }); }
      });
    },

    getNextWaitlistPosition: function (eventId) {
      return new Promise(r => {
        $.ajax({
          url: this.site + "/_api/web/lists/getbytitle('Registrations')/items?$filter=EventLookupId eq " + eventId + " and Status eq 'Waitlisted'&$orderby=WaitlistPosition desc&$top=1&$select=WaitlistPosition",
          headers: { Accept: "application/json; odata=verbose" },
          success: d => r((d.d.results[0]?.WaitlistPosition || 0) + 1),
          error: () => r(1)
        });
      });
    },

    // === AUTO-PROMOTE ON CANCEL ===
    unregister: function () {
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
                alert("Unregistered");
                this.loadEvents(); this.loadMyRegs();
                this.autoPromoteWaitlist(id); // <<< AUTO-PROMOTE
              }
            });
          }
        }
      });
    },

    autoPromoteWaitlist: function (eventId) {
      // Get first waitlisted user
      $.ajax({
        url: this.site + "/_api/web/lists/getbytitle('Registrations')/items?$filter=EventLookupId eq " + eventId + " and Status eq 'Waitlisted'&$orderby=WaitlistPosition asc&$top=1&$select=Id,UserEmail,WaitlistPosition",
        headers: { Accept: "application/json; odata=verbose" },
        success: d => {
          if (d.d.results.length) {
            const reg = d.d.results[0];
            $.ajax({
              url: this.site + "/_api/web/lists/getbytitle('Registrations')/items(" + reg.Id + ")",
              type: "POST",
              data: JSON.stringify({ '__metadata': { type: 'SP.Data.RegistrationsListItem' }, Status: 'Confirmed' }),
              headers: { "X-RequestDigest": this.digest, "If-Match": "*", "X-HTTP-Method": "MERGE" },
              success: () => {
                // Send promotion email via workflow (triggered by update)
                console.log("Promoted: " + reg.UserEmail);
              }
            });
          }
        }
      });
    },

    // === UI: CARDS WITH WAITLIST STATUS ===
    renderCards: function (events) {
      const filtered = events.filter(e =>
        e.Title.toLowerCase().includes(this.state.search) ||
        (e.Room && e.Room.toLowerCase().includes(this.state.search))
      );

      const cards = filtered.map(ev => {
        const myReg = this.state.myRegs.find(r => r.EventLookupId === ev.Id);
        const isFull = ev.MaxSeats && ev.regCount >= ev.MaxSeats;
        const isPast = new Date(ev.EndTime) < new Date();
        const canReg = ev.AllowRegistration && !isPast;

        const panelCls = isFull || isPast ? "panel panel-default card-full" + (isPast ? " card-past" : "") : "panel panel-primary";

        let btn;
        if (!canReg) {
          btn = h("button", { className: "btn btn-default btn-sm disabled" }, isFull ? "Full" : "Closed");
        } else if (myReg) {
          if (myReg.Status === 'Confirmed') {
            btn = h("button", { className: "btn btn-success btn-sm disabled" }, "Registered");
          } else if (myReg.Status === 'Waitlisted') {
            btn = h("button", { className: "btn btn-warning btn-sm disabled" }, `Waitlist #${myReg.WaitlistPosition}`);
          }
          btn = h("div", null, btn,
            h("button", { className: "btn btn-danger btn-sm", onClick: () => this.showUnreg(ev.Id) }, "Cancel")
          );
        } else {
          btn = h("button", { className: "btn btn-success btn-sm", onClick: () => this.register(ev.Id) },
            isFull ? "Join Waitlist" : "Register"
          );
        }

        const attachments = ev.Attachments
          ? h("a", { href: this.site + "/_api/web/lists/getbytitle('Events')/items(" + ev.Id + ")/AttachmentFiles", target: "_blank", className: "btn btn-link btn-xs" }, "Resources")
          : null;

        return h("div", { key: ev.Id, className: "col-md-6 mb-3" },
          h("div", { className: panelCls },
            h("div", { className: "panel-heading" }, ev.Title),
            h("div", { className: "panel-body" },
              h("p", null, "Time: ", new Date(ev.StartTime).toLocaleString(), " – ", new Date(ev.EndTime).toLocaleString()),
              h("p", null, "Room: ", ev.Room || "TBD"),
              h("p", null, "Instructor: ", ev.Instructor ? ev.Instructor.Title : "TBD"),
              h("p", null, "Seats: ", ev.regCount, "/", ev.MaxSeats || "Unlimited"),
              myReg && myReg.Status === 'Waitlisted' ? h("p", { className: "text-warning" }, "Waitlist Position: #", myReg.WaitlistPosition) : null,
              attachments
            ),
            h("div", { className: "panel-footer text-right" }, btn)
          )
        );
      });

      ReactDOM.render(h("div", null, cards), document.getElementById("root"));
    },

    // FullCalendar, showUnreg, etc. (unchanged)
    showUnreg: function (id) { this.setState({ unregId: id }); $("#unregModal").modal("show"); },
    renderCalendar: function (events) { /* same as before */ }
  });

  $(document).on('click', '#confirmUnreg', function () {
    window.reactApp && window.reactApp.unregister();
  });

  const root = React.createElement(App);
  ReactDOM.render(root, document.getElementById("root"));
  window.reactApp = root;
});