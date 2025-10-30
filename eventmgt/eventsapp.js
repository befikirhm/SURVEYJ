// === SAFE jQuery + FullCalendar (NO CONFLICT) ===
(function ($, React, ReactDOM, jQuery) {

  // Save original jQuery
  var $original = jQuery;

  // Restore jQuery for FullCalendar
  window.jQuery = $original;
  window.$ = $original;

  // === WAIT FOR SP CONTEXT ===
  function waitForSpContext(cb) {
    if (typeof _spPageContextInfo !== 'undefined') {
      cb();
    } else {
      var i = setInterval(function () {
        if (typeof _spPageContextInfo !== 'undefined') {
          clearInterval(i);
          cb();
        }
      }, 100);
    }
  }

  waitForSpContext(function () {
    $(document).ready(function () {

      let app = null;

      class App extends React.Component {
        constructor() {
          super();
          this.state = { events: [], myRegs: [], isAdmin: false, search: '', loading: true, unregId: null };
          this.handleSearch = this.handleSearch.bind(this);
          this.register = this.register.bind(this);
          this.showUnreg = this.showUnreg.bind(this);
          this.unregister = this.unregister.bind(this);
        }

        componentDidMount() {
          this.site = _spPageContextInfo.webAbsoluteUrl;
          this.userEmail = _spPageContextInfo.userLoginName;
          this.digest = $("#__REQUESTDIGEST").val();

          $('#searchBox').on('input', this.handleSearch);
          $('a[data-toggle="tab"]').on('shown.bs.tab', e => {
            if ($(e.target).attr('href') === '#cards' && this.state.events.length) {
              this.renderCards(this.state.events);
            }
          });

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
            if ($('#cards').hasClass('active')) this.renderCards(this.state.events);
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
                    this.renderCalendar(evs);
                    if ($('#cards').hasClass('active')) this.renderCards(evs);
                  });
                });
            },
            error: () => {
              $("#loading").hide();
              alert("Failed to load events.");
            }
          });
        }

        loadMyRegs() {
          $.ajax({
            url: this.site + "/_api/web/lists/getbytitle('Registrations')/items?$filter=UserEmail eq '" + this.userEmail + "'&$select=EventLookupId,Status,WaitlistPosition",
            headers: { Accept: "application/json; odata=verbose" },
            success: d => this.setState({ myRegs: d.d.results || [] })
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
          const ev = this.state.events.find(e => e.Id === id);
          if (!ev || !ev.AllowRegistration) return alert("Closed");
          this.getRegCount(id).then(count => {
            const full = ev.MaxSeats && count >= ev.MaxSeats;
            if (!full) this.createReg(id, 'Confirmed', null);
            else this.getNextWaitlistPosition(id).then(pos => {
              if (confirm(`Full. Join waitlist at #${pos}?`)) this.createReg(id, 'Waitlisted', pos);
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
            }
          });
        }

        getNextWaitlistPosition(id) {
          return new Promise(r => {
            $.ajax({
              url: this.site + "/_api/web/lists/getbytitle('Registrations')/items?$filter=EventLookupId eq " + id + " and Status eq 'Waitlisted'&$orderby=WaitlistPosition desc&$top=1&$select=WaitlistPosition",
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
                $.ajax({
                  url: this.site + "/_api/web/lists/getbytitle('Registrations')/items(" + d.d.results[0].Id + ")",
                  type: "POST",
                  headers: { "X-RequestDigest": this.digest, "If-Match": "*", "X-HTTP-Method": "DELETE" },
                  success: () => {
                    alert("Cancelled");
                    this.loadEvents();
                    this.loadMyRegs();
                  }
                });
              }
            }
          });
        }

        renderCalendar(events) {
          const calEvents = events.map(e => ({
            title: e.Title + (e.MaxSeats ? ` (${e.regCount}/${e.MaxSeats})` : ''),
            start: e.StartTime,
            end: e.EndTime,
            id: e.Id,
            color: e.IsOver ? '#999' : (e.regCount >= e.MaxSeats ? '#d9534f' : '#5cb85c')
          }));

          $('#calendar').fullCalendar('destroy');
          $('#calendar').fullCalendar({
            header: { left: 'prev,next today', center: 'title', right: 'month,agendaWeek,agendaDay' },
            events: calEvents
          });
        }

        renderCards(events) {
          const filtered = events.filter(e =>
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
            if (!canReg) btn = React.createElement("button", { className: "btn btn-default btn-sm disabled" }, isFull ? "Full" : "Closed");
            else if (myReg) {
              btn = React.createElement("button", { className: "btn btn-success btn-sm disabled" }, myReg.Status === 'Confirmed' ? "Registered" : `Waitlist #${myReg.WaitlistPosition}`);
              btn = React.createElement("div", null, btn,
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
          }) : [React.createElement("div", { className: "alert alert-info" }, "No events found.")];

          ReactDOM.render(React.createElement("div", { className: "row" }, cards), document.getElementById("root"));
        }

        render() { return null; }
      }

      $(document).on('click', '#confirmUnreg', () => app?.unregister());

      const rootApp = React.createElement(App);
      ReactDOM.render(rootApp, document.getElementById("root"));
      app = rootApp;

      $("#loading").show();
    });
  });

})(jQuery, React, ReactDOM, jQuery); // Pass same jQuery