$(document).ready(function () {
  const { createClass, createElement: h } = React;

  const App = createClass({
    getInitialState: function () {
      return {
        events: [], myRegs: [], isAdmin: false,
        search: '', loading: false, unregId: null
      };
    },

    componentDidMount: function () {
      this.site = _spPageContextInfo.webAbsoluteUrl;
      this.userId = _spPageContextInfo.userId;
      this.digest = $("#__REQUESTDIGEST").val();

      // Search box live filter
      $('#searchBox').on('input', e => this.setState({ search: e.target.value.toLowerCase() }));

      this.checkAdmin(() => {
        this.loadEvents();
        this.loadMyRegs();
      });
    },

    /* ---------- ADMIN CHECK ---------- */
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
        h("a", { href: "AdminDashboard.aspx", className: "btn btn-warning btn-block mb-2" },
          h("span", { className: "glyphicon glyphicon-cog" }), " Admin Dashboard"),
        h("a", { href: "Survey.aspx", className: "btn btn-info btn-block" },
          h("span", { className: "glyphicon glyphicon-list-alt" }), " Design Survey")
      );
      ReactDOM.render(links, document.getElementById("adminLinks"));
    },

    /* ---------- DATA LOAD ---------- */
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
            .then(evs => this.setState({ events: evs, loading: false }, () => $("#loading").hide()));
        }
      });
    },

    loadMyRegs: function () {
      $.ajax({
        url: this.site + "/_api/web/lists/getbytitle('Registrations')/items?$filter=UserEmail eq '" + _spPageContextInfo.userLoginName + "'&$select=EventLookupId,Status",
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

    /* ---------- REGISTRATION ---------- */
    register: function (id) {
      this.setState({ loading: true });
      $.ajax({
        url: this.site + "/_api/web/lists/getbytitle('Registrations')/items",
        type: "POST",
        data: JSON.stringify({
          '__metadata': { type: 'SP.Data.RegistrationsListItem' },
          EventLookupId: id,
          UserEmail: _spPageContextInfo.userLoginName,
          Status: 'Confirmed'
        }),
        headers: {
          Accept: "application/json; odata=verbose",
          "X-RequestDigest": this.digest,
          "Content-Type": "application/json; odata=verbose"
        },
        success: () => {
          alert("Registered!");
          this.loadEvents(); this.loadMyRegs();
        },
        error: e => {
          alert("Error: " + e.responseText);
          this.setState({ loading: false });
        }
      });
    },

    showUnreg: function (id) {
      this.setState({ unregId: id });
      $("#unregModal").modal("show");
    },

    unregister: function () {
      const id = this.state.unregId;
      $("#unregModal").modal("hide");
      $.ajax({
        url: this.site + "/_api/web/lists/getbytitle('Registrations')/items?$filter=EventLookupId eq " + id + " and UserEmail eq '" + _spPageContextInfo.userLoginName + "'",
        headers: { Accept: "application/json; odata=verbose" },
        success: d => {
          if (d.d.results.length) {
            $.ajax({
              url: this.site + "/_api/web/lists/getbytitle('Registrations')/items(" + d.d.results[0].Id + ")",
              type: "POST",
              headers: {
                "X-RequestDigest": this.digest,
                "If-Match": "*",
                "X-HTTP-Method": "DELETE"
              },
              success: () => {
                alert("Unregistered");
                this.loadEvents(); this.loadMyRegs();
              }
            });
          }
        }
      });
    },

    /* ---------- RENDER ---------- */
    render: function () {
      const { events, myRegs, isAdmin, search } = this.state;
      const now = new Date();

      const filtered = events.filter(e =>
        e.Title.toLowerCase().includes(search) ||
        (e.Room && e.Room.toLowerCase().includes(search))
      );

      const cards = filtered.map(ev => {
        const isReg   = myRegs.some(r => r.EventLookupId === ev.Id && r.Status === 'Confirmed');
        const isFull  = ev.MaxSeats && ev.regCount >= ev.MaxSeats;
        const isPast  = new Date(ev.EndTime) < now;
        const canReg  = ev.AllowRegistration && !isFull && !isPast;

        const panelCls = isFull || isPast
          ? "panel panel-default card-full" + (isPast ? " card-past" : "")
          : "panel panel-primary";

        const btn = canReg
          ? isReg
            ? h("button", { className: "btn btn-danger btn-sm", onClick: () => this.showUnreg(ev.Id) },
                h("span", { className: "glyphicon glyphicon-remove" }), " Unregister")
            : h("button", { className: "btn btn-success btn-sm", onClick: () => this.register(ev.Id) },
                h("span", { className: "glyphicon glyphicon-ok" }), " Register")
          : h("button", { className: "btn btn-default btn-sm disabled" }, isFull ? "Full" : "Closed");

        const attachments = ev.Attachments
          ? h("a", { href: ev["@odata.mediaReadUrl"] || "#", target: "_blank", className: "btn btn-link btn-xs" },
              h("span", { className: "glyphicon glyphicon-paperclip" }), " Resources")
          : null;

        return h("div", { key: ev.Id, className: "col-md-6 mb-3" },
          h("div", { className: panelCls },
            h("div", { className: "panel-heading" },
              h("strong", null, ev.Title)
            ),
            h("div", { className: "panel-body" },
              h("p", null,
                h("span", { className: "glyphicon glyphicon-time" }), " ",
                new Date(ev.StartTime).toLocaleString(), " – ", new Date(ev.EndTime).toLocaleString()
              ),
              h("p", null,
                h("span", { className: "glyphicon glyphicon-map-marker" }), " ", ev.Room || "TBD"
              ),
              h("p", null,
                h("span", { className: "glyphicon glyphicon-user" }), " ", ev.Instructor ? ev.Instructor.Title : "TBD"
              ),
              h("p", null,
                h("span", { className: "glyphicon glyphicon-list-alt" }), " ",
                ev.regCount, "/", ev.MaxSeats || "Unlimited"
              ),
              attachments
            ),
            h("div", { className: "panel-footer text-right" },
              btn,
              isAdmin ? h("a", { href: this.site + "/Lists/Events/EditForm.aspx?ID=" + ev.Id,
                                 className: "btn btn-info btn-xs" },
                           h("span", { className: "glyphicon glyphicon-edit" }), " Edit") : null
            )
          )
        );
      });

      return h("div", null,
        cards.length ? cards : h("div", { className: "alert alert-info" }, "No events match your search.")
      );
    }
  });

  /* ---------- MODAL CONFIRM ---------- */
  $(document).on('click', '#confirmUnreg', function () {
    window.reactApp && window.reactApp.unregister();
  });

  const root = React.createElement(App);
  ReactDOM.render(root, document.getElementById('root'));
  window.reactApp = root;   // expose for modal
});