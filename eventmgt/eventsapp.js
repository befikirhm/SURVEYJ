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

// === ERROR HANDLER ===
function handleError(step, error, userMessage = "An error occurred.") {
  console.error(`[ERROR] ${step}:`, error);
  $("#loading").hide();
  alert(`${userMessage}\n\nCheck browser console (F12) for details.`);
}

// === MAIN APP ===
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
        try {
          this.site = _spPageContextInfo.webAbsoluteUrl;
          this.userEmail = _spPageContextInfo.userLoginName;
          this.digest = $("#__REQUESTDIGEST").val();

          if (!this.site || !this.userEmail || !this.digest) {
            throw new Error("Missing SharePoint context: site, user, or digest");
          }

          console.log("SharePoint context loaded:", { site: this.site, user: this.userEmail });

          $('#searchBox').on('input', this.handleSearch);

          // === ALWAYS CALL loadEvents() AFTER ADMIN CHECK ===
          this.checkAdmin(() => {
            console.log("Admin check complete. Loading events...");
            this.loadEvents();
            this.loadMyRegs();
          });

        } catch (err) {
          handleError("Initialization", err, "App failed to start.");
        }
      }

      // === ADMIN CHECK – ALWAYS CALLS CALLBACK ===
      checkAdmin(cb) {
        $.ajax({
          url: this.site + "/_api/web/currentuser/groups?$filter=Title eq 'Event Managers'",
          headers: { Accept: "application/json; odata=verbose" },
          timeout: 10000,
          success: d => {
            try {
              const admin = d.d?.results?.length > 0;
              console.log("Admin status:", admin);
              this.setState({ isAdmin: admin });
              if (admin) this.renderAdminLinks();
            } catch (err) {
              console.warn("Failed to parse admin response:", err);
            }
            cb(); // ALWAYS CALL
          },
          error: (xhr) => {
            console.warn("Admin check failed (non-critical):", xhr.status, xhr.statusText);
            cb(); // ALWAYS CALL EVEN ON ERROR
          }
        });
      }

      renderAdminLinks() {
        try {
          const links = React.createElement("div", null,
            React.createElement("a", { href: "AdminDashboard.aspx", className: "btn btn-warning btn-block mb-2" }, "Admin Dashboard"),
            React.createElement("a", { href: "Survey.aspx", className: "btn btn-info btn-block" }, "Design Survey")
          );
          ReactDOM.render(links, document.getElementById("adminLinks"));
          console.log("Admin links rendered");
        } catch (err) {
          console.error("Failed to render admin links:", err);
        }
      }

      handleSearch(e) {
        const value = e.target.value.toLowerCase();
        this.setState({ search: value }, () => {
          if (!this.state.loading) this.renderCards();
        });
      }

      // === loadEvents() – GUARANTEED TO RUN ===
      loadEvents() {
        console.log("loadEvents() STARTED");

        const q = "?$select=Id,Title,StartTime,EndTime,Room,Instructor/Title,MaxSeats,AllowRegistration,IsOver,Attachments&$expand=Instructor";
        const url = this.site + "/_api/web/lists/getbytitle('Events')/items" + q;

        $.ajax({
          url: url,
          headers: { Accept: "application/json; odata=verbose" },
          timeout: 15000,
          success: d => {
            console.log("Events API success:", d);

            try {
              if (!d?.d?.results) throw new Error("Invalid response: no results");

              let evs = d.d.results.sort((a, b) => new Date(a.StartTime) - new Date(b.StartTime));
              console.log(`Loaded ${evs.length} events`);

              if (evs.length === 0) {
                this.setState({ events: [], loading: false }, () => {
                  $("#loading").hide();
                  this.renderCards();
                });
                return;
              }

              // Count registrations
              Promise.all(evs.map(e => this.getRegCount(e.Id).then(c => ({ ...e, regCount: c }))))
                .then(processed => {
                  console.log("Events with regCount:", processed);
                  this.setState({ events: processed, loading: false }, () => {
                    $("#loading").hide();
                    this.renderCards();
                  });
                })
                .catch(err => {
                  console.error("Failed to count registrations:", err);
                  // Still show events even if count fails
                  this.setState({ events: evs.map(e => ({ ...e, regCount: 0 })), loading: false }, () => {
                    $("#loading").hide();
                    this.renderCards();
                  });
                });

            } catch (err) {
              handleError("Parse Events", err, "Failed to process event data.");
            }
          },
          error: (xhr, status, err) => {
            let msg = "Failed to load events.";
            if (status === "timeout") msg += " (Request timed out)";
            else if (xhr.status === 404) msg += " (List 'Events' not found)";
            else if (xhr.status === 403) msg += " (Access denied)";
            handleError("Load Events", { xhr, status, err }, msg);
          }
        });
      }

      loadMyRegs() {
        const url = this.site + "/_api/web/lists/getbytitle('Registrations')/items?$filter=UserEmail eq '" + encodeURIComponent(this.userEmail) + "'&$select=EventLookupId,Status,WaitlistPosition";
        $.ajax({
          url: url,
          headers: { Accept: "application/json; odata=verbose" },
          timeout: 10000,
          success: d => {
            try {
              this.setState({ myRegs: d.d?.results || [] });
              console.log("My registrations loaded:", d.d?.results);
            } catch (err) {
              console.warn("Failed to parse my registrations:", err);
            }
          },
          error: () => {
            console.warn("Failed to load my registrations (non-critical)");
          }
        });
      }

      getRegCount(id) {
        return new Promise(resolve => {
          $.ajax({
            url: this.site + "/_api/web/lists/getbytitle('Registrations')/items?$filter=EventLookupId eq " + id + " and Status eq 'Confirmed'&$select=Id",
            headers: { Accept: "application/json; odata=verbose" },
            timeout: 8000,
            success: d => resolve(d.d?.results?.length || 0),
            error: () => resolve(0)
          });
        });
      }

      register(id) {
        const event = this.state.events.find(e => e.Id === id);
        if (!event) return alert("Event not found.");
        if (!event.AllowRegistration) return alert("Registration closed.");

        this.getRegCount(id)
          .then(count => {
            const isFull = event.MaxSeats && count >= event.MaxSeats;
            if (!isFull) {
              this.createRegistration(id, 'Confirmed', null);
            } else {
              this.getNextWaitlistPosition(id)
                .then(pos => {
                  if (confirm(`Event full. Join waitlist at #${pos}?`)) {
                    this.createRegistration(id, 'Waitlisted', pos);
                  }
                })
                .catch(() => alert("Could not get waitlist position."));
            }
          })
          .catch(() => alert("Could not check seats."));
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
            alert(status === 'Confirmed' ? 'Registered!' : `Waitlist #${position}`);
            this.loadEvents();
            this.loadMyRegs();
          },
          error: xhr => {
            const msg = xhr.responseJSON?.error?.message?.value || "Unknown error";
            alert(`Registration failed: ${msg}`);
          }
        });
      }

      getNextWaitlistPosition(eventId) {
        return new Promise(resolve => {
          $.ajax({
            url: this.site + "/_api/web/lists/getbytitle('Registrations')/items?$filter=EventLookupId eq " + eventId + " and Status eq 'Waitlisted'&$orderby=WaitlistPosition desc&$top=1&$select=WaitlistPosition",
            headers: { Accept: "application/json; odata=verbose" },
            success: d => {
              const last = d.d?.results?.[0]?.WaitlistPosition;
              resolve((last || 0) + 1);
            },
            error: () => resolve(1)
          });
        });
      }

      showUnreg(id) {
        this.setState({ unregId: id });
        $("#unregModal").modal("show");
      }

      unregister() {
        const id = this.state.unregId;
        if (!id) return;

        $("#unregModal").modal("hide");

        $.ajax({
          url: this.site + "/_api/web/lists/getbytitle('Registrations')/items?$filter=EventLookupId eq " + id + " and UserEmail eq '" + encodeURIComponent(this.userEmail) + "'",
          headers: { Accept: "application/json; odata=verbose" },
          success: d => {
            const reg = d.d?.results?.[0];
            if (!reg) return alert("No registration found.");

            $.ajax({
              url: this.site + "/_api/web/lists/getbytitle('Registrations')/items(" + reg.Id + ")",
              type: "POST",
              headers: { "X-RequestDigest": this.digest, "If-Match": "*", "X-HTTP-METHOD": "DELETE" },
              success: () => {
                alert("Cancelled");
                this.loadEvents();
                this.loadMyRegs();
                this.autoPromoteWaitlist(id);
              },
              error: () => alert("Failed to cancel.")
            });
          },
          error: () => alert("Could not find registration.")
        });
      }

      autoPromoteWaitlist(eventId) {
        $.ajax({
          url: this.site + "/_api/web/lists/getbytitle('Registrations')/items?$filter=EventLookupId eq " + eventId + " and Status eq 'Waitlisted'&$orderby=WaitlistPosition asc&$top=1&$select=Id",
          headers: { Accept: "application/json; odata=verbose" },
          success: d => {
            const next = d.d?.results?.[0];
            if (next) {
              $.ajax({
                url: this.site + "/_api/web/lists/getbytitle('Registrations')/items(" + next.Id + ")",
                type: "POST",
                data: JSON.stringify({ '__metadata': { type: 'SP.Data.RegistrationsListItem' }, Status: 'Confirmed' }),
                headers: { "X-RequestDigest": this.digest, "If-Match": "*", "X-HTTP-METHOD": "MERGE" },
                success: () => console.log("Promoted:", next.Id)
              });
            }
          }
        });
      }

      renderCards() {
        if (this.state.loading) return;

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
            const statusBtn = myReg.Status === 'Confirmed'
              ? React.createElement("button", { className: "btn btn-success btn-sm disabled" }, "Registered")
              : React.createElement("button", { className: "btn btn-warning btn-sm disabled" }, `Waitlist #${myReg.WaitlistPosition}`);
            btn = React.createElement("div", null, statusBtn,
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
                React.createElement("p", null, "Instructor: ", ev.Instructor?.Title || "TBD"),
                React.createElement("p", null, "Seats: ", ev.regCount, "/", ev.MaxSeats || "Unlimited"),
                myReg && myReg.Status === 'Waitlisted' ? React.createElement("p", { className: "text-warning" }, "Waitlist #", myReg.WaitlistPosition) : null,
                attachments
              ),
              React.createElement("div", { className: "panel-footer text-right" }, btn)
            )
          );
        }) : [React.createElement("div", { key: "no", className: "alert alert-info" }, "No events found.")];

        try {
          ReactDOM.render(React.createElement("div", { className: "row" }, cards), document.getElementById("root"));
        } catch (err) {
          console.error("Render failed:", err);
          alert("Display error.");
        }
      }

      render() { return null; }
    }

    // === MODAL ===
    $(document).on('click', '#confirmUnreg', () => appInstance?.unregister());

    // === START APP ===
    try {
      const app = React.createElement(App);
      ReactDOM.render(app, document.getElementById("root"));
      appInstance = app;
      $("#loading").show();
      console.log("App rendered. Waiting for data...");
    } catch (err) {
      handleError("App Start", err, "Failed to start app.");
    }
  });
});