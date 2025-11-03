// === SP 2016 ON-PREM – MODULAR EVENTS APP ===
(function (global, React, ReactDOM, $) {
  'use strict';

  // === API UTILITIES ===
  const api = {
    // ... (Keep existing api methods unchanged, except for loadEvents below)

    loadEvents(site, digest, maxRetries = 2) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [API loadEvents] Starting, retries: ${maxRetries}`);
      const q = "?$select=Id,Title,StartDate,EndDate,Location,Instructor,MaxSeats,AllowRegistration,IsOver,Attachments";
      const url = site + "/_api/web/lists/getbytitle('Events')/items" + q;

      const attemptLoad = (attempt) => {
        return $.ajax({ url, headers: { Accept: "application/json; odata=verbose" }, timeout: 15000 }).then(d => {
          console.log(`[${timestamp}] [API loadEvents] Raw response:`, d);
          let evs = (d.d?.results || []).map((ev, index) => {
            const startDate = ev.StartDate ? new Date(ev.StartDate) : null;
            const endDate = ev.EndDate ? new Date(ev.EndDate) : null;
            console.log(`[${timestamp}] [API loadEvents] Event ${index + 1}:`, { Id: ev.Id, Title: ev.Title, StartDate: ev.StartDate });
            if (!ev.Id || !ev.Title || !startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
              console.warn(`[${timestamp}] [API loadEvents] Skipping invalid event:`, ev);
              return null;
            }
            return {
              Id: ev.Id,
              Title: ev.Title,
              StartTime: startDate.toISOString(),
              EndTime: endDate.toISOString(),
              Room: ev.Location || "TBD",
              Instructor: ev.Instructor || "TBD",
              MaxSeats: ev.MaxSeats || null,
              AllowRegistration: !!ev.AllowRegistration,
              IsOver: !!ev.IsOver,
              Attachments: ev.Attachments || false,
              regCount: 0
            };
          }).filter(ev => ev !== null).sort((a, b) => new Date(a.StartTime) - new Date(b.StartTime));  // Sort by start time ascending

          console.log(`[${timestamp}] [API loadEvents] Events processed:`, evs.length);
          if (evs.length === 0) return evs;

          return Promise.all(evs.map(e => this.getRegCount(site, e.Id).then(c => ({ ...e, regCount: c }))))
            .then(processed => {
              console.log(`[${timestamp}] [API loadEvents] Events with reg counts:`, processed.length);
              return processed;
            });
        }).catch(xhr => {
          if (attempt < maxRetries) {
            console.warn(`[${timestamp}] [API loadEvents] Attempt ${attempt} failed, retrying...`);
            return attemptLoad(attempt + 1);
          }
          let msg = "Failed to load events.";
          if (xhr.status === 404) msg = "List 'Events' not found.";
          if (xhr.status === 403) msg = "Access denied to Events list.";
          return this.handleError("loadEvents", xhr, msg);
        });
      };
      return attemptLoad(1);
    },

    // New API for saving survey response
    saveSurveyResponse(site, digest, responseData) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [API saveSurveyResponse] Saving response...`);
      return $.ajax({
        url: site + "/_api/web/lists/getbytitle('SurveyResponses')/items",
        type: "POST",
        data: JSON.stringify({
          '__metadata': { type: 'SP.Data.SurveyResponsesListItem' },
          Title: 'Event Feedback Response',
          SurveyJSON: JSON.stringify(responseData),
          EventTitles: responseData.eventTitles.join(', '),
          SubmittedBy: _spPageContextInfo?.userDisplayName || 'Unknown',
          SubmitDate: new Date().toISOString()
        }),
        headers: {
          Accept: "application/json; odata=verbose",
          "X-RequestDigest": digest,
          "Content-Type": "application/json; odata=verbose"
        },
        timeout: 15000
      }).then(() => ({ success: true, message: 'Response saved successfully!' })).catch(xhr => {
        const msg = xhr.responseJSON?.error?.message?.value || "Failed to save response";
        return { success: false, message: msg };
      });
    },

    // ... (Keep all other existing api methods unchanged)
  };

  // === COMPONENTS ===
  const components = {
    // ... (Keep existing ErrorBoundary, UnregModal, AdminLinks, LoadingIndicator unchanged)

    EventCards({ events, myRegs, search, register, showUnreg, refreshMyRegs }) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [EventCards] Rendering ${events.length} events`, {
        search,
        events: events.map(e => ({ Id: e.Id, Title: e.Title }))
      });

      const validEvents = events.filter(e => {
        const isValid =
          e &&
          Number.isInteger(e.Id) &&
          typeof e.Title === 'string' &&
          e.Title &&
          e.StartTime &&
          e.EndTime &&
          !isNaN(new Date(e.StartTime).getTime()) &&
          !isNaN(new Date(e.EndTime).getTime());
        if (!isValid) console.warn(`[${timestamp}] [EventCards] Invalid event:`, e);
        return isValid;
      });
      console.log(`[${timestamp}] [EventCards] Valid events:`, validEvents.length);

      const filtered = validEvents.filter(e =>
        (e.Title || "").toLowerCase().includes(search.toLowerCase()) ||
        (e.Room || "").toLowerCase().includes(search.toLowerCase())
      );
      console.log(`[${timestamp}] [EventCards] Filtered events:`, filtered.length);

      if (!filtered.length) {
        return React.createElement("div", { className: "alert alert-info text-center" }, "No valid events found.");
      }

      const cards = filtered.map((ev, index) => {
        console.log(`[${timestamp}] [EventCards] Processing event ${index + 1}:`, { Id: ev.Id, Title: ev.Title });
        try {
          const myReg = myRegs.find(r => r.EventLookupId === ev.Id);
          const isFull = ev.MaxSeats && ev.regCount >= ev.MaxSeats;
          const endDate = new Date(ev.EndTime);
          const now = new Date();
          const isPast = endDate.getTime() < now.getTime();
          const canReg = ev.AllowRegistration && !isPast && !ev.IsOver;

          const panelCls = isFull || isPast || ev.IsOver
            ? "panel panel-default card-full" + (isPast ? " card-past" : "")
            : "panel panel-primary";

          let btn;
          if (!canReg) {
            btn = React.createElement("button", { className: "btn btn-default btn-sm disabled" }, isFull ? "Full" : "Closed");
          } else if (myReg) {
            const status = myReg.Status === 'Confirmed'
              ? React.createElement("button", { className: "btn btn-success btn-sm disabled" }, "Registered")
              : React.createElement("button", { className: "btn btn-warning btn-sm disabled" }, `Waitlist #${myReg.WaitlistPosition}`);
            btn = React.createElement("div", null, status,
              React.createElement("button", { className: "btn btn-danger btn-sm", onClick: () => showUnreg(ev.Id) }, "Cancel")
            );
          } else {
            btn = React.createElement("div", null,
              React.createElement("button", {
                className: "btn btn-success btn-sm",
                onClick: () => register(ev.Id)
              }, isFull ? "Join Waitlist" : "Register"),
              React.createElement("button", {
                className: "btn btn-info btn-sm",
                onClick: () => refreshMyRegs()
              }, "Refresh")
            );
          }

          // Generate unique surveyId for this event set (hash of titles for simplicity)
          const surveyId = btoa(filtered.map(e => e.Title).join(',')).substring(0, 10);

          return React.createElement("div", { key: `event-${ev.Id}`, className: "col-md-6 mb-3" },
            React.createElement("div", { className: panelCls },
              React.createElement("div", { className: "panel-heading" }, ev.Title || "Untitled Event"),
              React.createElement("div", { className: "panel-body" },
                React.createElement("p", null, "Time: ",
                  ev.StartTime ? new Date(ev.StartTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : "TBD",
                  " - ",
                  ev.EndTime ? new Date(ev.EndTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : "TBD"
                ),
                React.createElement("p", null, "Room: ", ev.Room || "TBD"),
                React.createElement("p", null, "Instructor: ", ev.Instructor || "TBD")
              ),
              React.createElement("div", { className: "panel-footer" },
                React.createElement("div", { className: "pull-left" },
                  React.createElement("p", { className: "nomargin" }, "Seats: ", ev.regCount, "/", ev.MaxSeats || "Unlimited")
                ),
                React.createElement("div", { className: "pull-right" }, btn)
              )
            )
          );
        } catch (e) {
          console.error(`[${timestamp}] [EventCards] Failed to create card for Event ID ${ev.Id}:`, e);
          return null;
        }
      }).filter(card => card !== null);

      console.log(`[${timestamp}] [EventCards] Generated ${cards.length} cards`);
      return React.createElement("div", { className: "row event-row" }, cards);
    },

    // New SurveyModal component for admins
    SurveyModal({ showModal, setShowModal, events, site, digest }) {
      const timestamp = new Date().toISOString();
      const [survey, setSurvey] = React.useState(null);
      const [isDesigner, setIsDesigner] = React.useState(true);  // Toggle between design/fill
      const surveyElementRef = React.useRef(null);

      React.useEffect(() => {
        if (showModal && events.length > 0) {
          const eventTitles = events.map(e => e.Title);
          const surveyJson = {
            title: "Event Feedback Survey",
            pages: [{
              name: "page1",
              elements: [
                ...eventTitles.map(title => ({
                  type: "rating",
                  name: title.replace(/\s+/g, '_').toLowerCase(),
                  title: `How would you rate "${title}"?`,
                  isRequired: true,
                  rateMin: 1,
                  rateMax: 5,
                  minRateDescription: "Poor",
                  maxRateDescription: "Excellent",
                  renderAs: "stars"
                })),
                {
                  type: "textarea",
                  name: "comments",
                  title: "Any ideas for future classes, comments, concerns or suggestion?",
                  isRequired: false,
                  maxLength: 1000,
                  rows: 5
                }
              ]
            }]
          };
          const newSurvey = new Survey.Model(surveyJson);
          newSurvey.onComplete.add((sender) => {
            const responseData = { ...sender.data, eventTitles };
            api.saveSurveyResponse(site, digest, responseData).then(result => {
              alert(result.message);
              setShowModal(false);
            });
          });
          setSurvey(newSurvey);
        }
      }, [showModal, events]);

      React.useEffect(() => {
        if (survey && surveyElementRef.current) {
          if (isDesigner) {
            const creator = new SurveyCreator.SurveyCreator({ survey });
            creator.render(surveyElementRef.current);
          } else {
            survey.render(surveyElementRef.current);
          }
        }
      }, [survey, isDesigner]);

      if (!showModal || !survey) return null;

      return [
        React.createElement("div", {
          key: "modal-backdrop",
          className: "modal-backdrop",
          style: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 1040 },
          onClick: () => setShowModal(false)
        }),
        React.createElement("div", {
          key: "modal",
          className: "modal",
          style: { display: "block", position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1050, overflow: "auto" }
        },
          React.createElement("div", { className: "modal-dialog", style: { margin: "5% auto", maxWidth: "800px", width: "90%" } },
            React.createElement("div", { className: "modal-content" },
              React.createElement("div", { className: "modal-header" },
                React.createElement("h4", { className: "modal-title" }, isDesigner ? "Design Survey" : "Fill Survey"),
                React.createElement("button", { className: "close", onClick: () => setShowModal(false) }, "×")
              ),
              React.createElement("div", { className: "modal-body" },
                React.createElement("div", {
                  ref: surveyElementRef,
                  style: { height: "500px", margin: "10px 0" }
                }),
                React.createElement("div", null,
                  React.createElement("button", {
                    className: "btn btn-secondary mr-2",
                    onClick: () => setIsDesigner(!isDesigner)
                  }, isDesigner ? "Switch to Fill Mode" : "Switch to Design Mode")
                )
              ),
              React.createElement("div", { className: "modal-footer" },
                React.createElement("button", { className: "btn btn-default", onClick: () => setShowModal(false) }, "Close"),
                !isDesigner && React.createElement("button", { className: "btn btn-primary", onClick: () => survey.completeLastPage() }, "Submit")
              )
            )
          )
        )
      ];
    }
  };

  // === MAIN APP ===
  const app = {
    // ... (Keep existing validateDependencies and init unchanged, except for App component below)

    init() {
      $(document).ready(async () => {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [App Init] DOM Ready`);

        try {
          this.validateDependencies();

          const root = document.getElementById('root');
          if (!root) {
            throw new Error("Root element not found. Check EventsDashboard.aspx for <div id='root'></div>");
          }
          root.innerHTML = '';
          root.style.display = 'block';
          root.style.visibility = 'visible';
          console.log(`[${timestamp}] [App Init] Root initialized:`, {
            display: root.style.display,
            visibility: root.style.visibility,
            computed: window.getComputedStyle(root).display
          });

          const ctx = await api.getContext();
          if (ctx.error) {
            throw new Error(ctx.message);
          }
          console.log(`[${timestamp}] [App Init] Context:`, { site: ctx.site, user: ctx.userEmail });

          const App = () => {
            const [events, setEvents] = React.useState([]);
            const [myRegs, setMyRegs] = React.useState([]);
            const [isAdmin, setIsAdmin] = React.useState(false);
            const [search, setSearch] = React.useState('');
            const [loading, setLoading] = React.useState(true);
            const [unregId, setUnregId] = React.useState(null);
            const [showModal, setShowModal] = React.useState(false);
            const [showSurveyModal, setShowSurveyModal] = React.useState(false);
            const [error, setError] = React.useState(null);

            const siteRef = React.useRef(ctx.site);
            const userEmailRef = React.useRef(ctx.userEmail);
            const digestRef = React.useRef(ctx.digest);

            React.useEffect(() => {
              const timestamp = new Date().toISOString();
              console.log(`[${timestamp}] [useEffect] Initializing...`);

              const timeout = setTimeout(() => {
                if (loading) {
                  console.error(`[${timestamp}] [useEffect] Loading timeout`);
                  setError("Loading timeout. Please try again.");
                  setLoading(false);
                }
              }, 30000);

              const loadData = async () => {
                try {
                  const isAdmin = await api.checkAdmin(siteRef.current);
                  setIsAdmin(isAdmin);
                  if (isAdmin) {
                    const adminRoot = document.getElementById("adminLinks");
                    if (adminRoot) {
                      ReactDOM.render(React.createElement(components.AdminLinks), adminRoot);
                      console.log(`[${timestamp}] [useEffect] Admin links rendered`);
                    }
                  }

                  const eventsData = await api.loadEvents(siteRef.current, digestRef.current);
                  if (eventsData.error) throw new Error(eventsData.message);
                  const regsData = await api.loadMyRegs(siteRef.current, userEmailRef.current);
                  if (regsData.error) throw new Error(regsData.message);

                  setEvents([...eventsData]);
                  setMyRegs([...regsData]);
                  setLoading(false);
                  console.log(`[${timestamp}] [useEffect] Data loaded:`, {
                    events: eventsData.length,
                    regs: regsData.length
                  });
                } catch (e) {
                  console.error(`[${timestamp}] [useEffect] Data load failed:`, e);
                  setError(`Failed to load data: ${e.message}`);
                  setLoading(false);
                }
                clearTimeout(timeout);
              };

              loadData();
              $('#searchBox').on('input', handleSearch);
              return () => $('#searchBox').off('input', handleSearch);
            }, []);

            // Synchronize #loading visibility with the loading state
            React.useEffect(() => {
              const timestamp = new Date().toISOString();
              console.log(`[${timestamp}] [useEffect] Updating loading indicator:`, { loading });
              if (loading) {
                $("#loading").show();
              } else {
                $("#loading").hide();
              }
            }, [loading]);

            const handleSearch = (e) => {
              const timestamp = new Date().toISOString();
              console.log(`[${timestamp}] [handleSearch] Search:`, e.target.value);
              setSearch(e.target.value);
            };

            // ... (Keep existing register, showUnreg, refreshMyRegs, handleConfirmUnreg unchanged)

            const handleDesignSurvey = () => {
              if (events.length === 0) {
                alert("No events available for survey.");
                return;
              }
              setShowSurveyModal(true);
            };

            // Render directly in the component
            if (error) {
              return React.createElement("div", { className: "alert alert-danger" }, error);
            }

            return React.createElement(components.ErrorBoundary, null,
              React.createElement("div", { className: "event-container" },
                loading && React.createElement(components.LoadingIndicator),
                !loading && React.createElement(components.EventCards, {
                  events,
                  myRegs,
                  search,
                  register,
                  showUnreg,
                  refreshMyRegs
                }),
                React.createElement(components.UnregModal, {
                  showModal,
                  unregId,
                  setShowModal,
                  handleConfirmUnreg
                }),
                React.createElement(components.SurveyModal, {
                  showModal: showSurveyModal,
                  setShowModal: setShowSurveyModal,
                  events,
                  site: siteRef.current,
                  digest: digestRef.current
                }),
                isAdmin && React.createElement("div", { className: "admin-footer mt-3 text-center" },
                  React.createElement("button", {
                    className: "btn btn-primary mr-2",
                    onClick: handleDesignSurvey
                  }, "Design Event Survey"),
                  React.createElement("a", {
                    href: `SurveyFiller.aspx?surveyId=${btoa(events.map(e => e.Title).join(','))}`,
                    target: "_blank",
                    className: "btn btn-info mr-2"
                  }, "Form Filler"),
                  React.createElement("a", {
                    href: `SurveyResponses.aspx?surveyId=${btoa(events.map(e => e.Title).join(','))}`,
                    target: "_blank",
                    className: "btn btn-secondary"
                  }, "Response Page")
                )
              )
            );
          };

          ReactDOM.render(React.createElement(App), root);
          console.log(`[${timestamp}] [App Init] App rendered`);
        } catch (e) {
          console.error(`[${timestamp}] [App Init] Failed:`, e);
          const root = document.getElementById('root');
          if (root) {
            root.innerHTML = '';
            ReactDOM.render(
              React.createElement("div", { className: "alert alert-danger" }, `Failed to initialize app: ${e.message}`),
              root
            );
            console.log(`[${timestamp}] [App Init] Error fallback rendered`);
          }
        }
      });
    }
  };

  // Start App
  app.init();
})(window, window.React, window.ReactDOM, window.jQuery);