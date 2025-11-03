// === SP 2016 ON-PREM – MODULAR EVENTS APP ===
(function (global, React, ReactDOM, $, Survey, SurveyCreator) {
  'use strict';

  // === API UTILITIES ===
  const api = {
    getContext() {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [API getContext] Fetching context...`);
      const ctx = window._spPageContextInfo;
      if (!ctx || !ctx.webAbsoluteUrl || !ctx.userLoginName) {
        console.error(`[${timestamp}] [API getContext] Missing context`);
        return Promise.resolve({ error: true, message: "SharePoint context unavailable" });
      }
      return Promise.resolve({
        error: false,
        site: ctx.webAbsoluteUrl,
        userEmail: ctx.userLoginName,
        digest: ctx.formDigestValue
      });
    },

    checkAdmin(site) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [API checkAdmin] Checking admin status...`);
      const url = site + "/_api/web/sitegroups/getbyname('Event Managers')/users?$filter=Email eq '" + _spPageContextInfo.userEmail + "'";
      return $.ajax({
        url,
        headers: { Accept: "application/json; odata=verbose" },
        timeout: 10000
      }).then(d => {
        const isAdmin = d.d.results && d.d.results.length > 0;
        console.log(`[${timestamp}] [API checkAdmin] User is${isAdmin ? '' : ' not'} admin`);
        return isAdmin;
      }).catch(xhr => {
        console.error(`[${timestamp}] [API checkAdmin] Error:`, xhr);
        return false;
      });
    },

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
          }).filter(ev => ev !== null).sort((a, b) => new Date(a.StartTime) - new Date(b.StartTime));

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
          return { error: true, message: msg };
        });
      };
      return attemptLoad(1);
    },

    loadMyRegs(site, userEmail) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [API loadMyRegs] Loading for ${userEmail}`);
      const q = "?$select=Id,EventLookupId,Status,WaitlistPosition,EventTitle&$filter=Registrant eq '" + userEmail + "'";
      const url = site + "/_api/web/lists/getbytitle('Registrations')/items" + q;
      return $.ajax({
        url,
        headers: { Accept: "application/json; odata=verbose" },
        timeout: 15000
      }).then(d => {
        const regs = (d.d?.results || []).map((r, index) => {
          console.log(`[${timestamp}] [API loadMyRegs] Registration ${index + 1}:`, { Id: r.Id, EventId: r.EventLookupId });
          return {
            Id: r.Id,
            EventLookupId: r.EventLookupId,
            Status: r.Status || "Unknown",
            WaitlistPosition: r.WaitlistPosition || null,
            EventTitle: r.EventTitle || "Unknown"
          };
        });
        console.log(`[${timestamp}] [API loadMyRegs] Loaded ${regs.length} registrations`);
        return regs;
      }).catch(xhr => {
        let msg = "Failed to load registrations.";
        if (xhr.status === 404) msg = "List 'Registrations' not found.";
        if (xhr.status === 403) msg = "Access denied to Registrations list.";
        return { error: true, message: msg };
      });
    },

    getRegCount(site, eventId) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [API getRegCount] Event ID: ${eventId}`);
      const q = "?$select=Id&$filter=EventLookupId eq " + eventId + " and Status eq 'Confirmed'";
      const url = site + "/_api/web/lists/getbytitle('Registrations')/items" + q;
      return $.ajax({
        url,
        headers: { Accept: "application/json; odata=verbose" },
        timeout: 10000
      }).then(d => {
        const count = (d.d?.results || []).length;
        console.log(`[${timestamp}] [API getRegCount] Count: ${count}`);
        return count;
      }).catch(xhr => {
        console.error(`[${timestamp}] [API getRegCount] Error:`, xhr);
        return 0;
      });
    },

    checkExistingRegistration(site, eventId, userEmail) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [API checkExistingRegistration] Checking Event ID: ${eventId}, User: ${userEmail}`);
      const q = "?$select=Id,Status,WaitlistPosition&$filter=EventLookupId eq " + eventId + " and Registrant eq '" + userEmail + "'";
      const url = site + "/_api/web/lists/getbytitle('Registrations')/items" + q;
      return $.ajax({
        url,
        headers: { Accept: "application/json; odata=verbose" },
        timeout: 10000
      }).then(d => {
        const result = d.d?.results?.[0];
        console.log(`[${timestamp}] [API checkExistingRegistration] Result:`, result);
        return result ? { Id: result.Id, Status: result.Status, WaitlistPosition: result.WaitlistPosition } : null;
      }).catch(xhr => {
        console.error(`[${timestamp}] [API checkExistingRegistration] Error:`, xhr);
        return null;
      });
    },

    refreshDigest(site) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [API refreshDigest] Refreshing...`);
      return $.ajax({
        url: site + "/_api/contextinfo",
        method: "POST",
        headers: { Accept: "application/json; odata=verbose" },
        timeout: 10000
      }).then(d => {
        const digest = d.d?.GetContextWebInformation?.FormDigestValue;
        console.log(`[${timestamp}] [API refreshDigest] Digest:`, digest ? "Received" : "Not received");
        return { digest };
      }).catch(xhr => {
        console.error(`[${timestamp}] [API refreshDigest] Error:`, xhr);
        return { digest: null };
      });
    },

    createReg(site, digest, eventId, userEmail, status, waitlistPosition, eventTitle) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [API createReg] Creating for Event ID: ${eventId}, Status: ${status}`);
      const data = {
        '__metadata': { type: 'SP.Data.RegistrationsListItem' },
        EventLookupId: eventId,
        Registrant: userEmail,
        Status: status,
        EventTitle: eventTitle
      };
      if (waitlistPosition !== null) data.WaitlistPosition = waitlistPosition;
      return $.ajax({
        url: site + "/_api/web/lists/getbytitle('Registrations')/items",
        type: "POST",
        data: JSON.stringify(data),
        headers: {
          Accept: "application/json; odata=verbose",
          "X-RequestDigest": digest,
          "Content-Type": "application/json; odata=verbose"
        },
        timeout: 15000
      }).then(() => {
        console.log(`[${timestamp}] [API createReg] Success`);
        return { success: true, message: status === 'Confirmed' ? "Registration successful!" : "Added to waitlist!" };
      }).catch(xhr => {
        const msg = xhr.responseJSON?.error?.message?.value || "Failed to register";
        console.error(`[${timestamp}] [API createReg] Error:`, xhr);
        return { success: false, message: msg };
      });
    },

    unregister(site, digest, eventId, userEmail) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [API unregister] Unregistering Event ID: ${eventId}, User: ${userEmail}`);
      const q = "?$select=Id&$filter=EventLookupId eq " + eventId + " and Registrant eq '" + userEmail + "'";
      const url = site + "/_api/web/lists/getbytitle('Registrations')/items" + q;
      return $.ajax({
        url,
        headers: { Accept: "application/json; odata=verbose" },
        timeout: 10000
      }).then(d => {
        const regId = d.d?.results?.[0]?.Id;
        if (!regId) {
          console.warn(`[${timestamp}] [API unregister] No registration found`);
          return { success: false, message: "No registration found." };
        }
        return $.ajax({
          url: site + "/_api/web/lists/getbytitle('Registrations')/items(" + regId + ")",
          type: "POST",
          headers: {
            Accept: "application/json; odata=verbose",
            "X-RequestDigest": digest,
            "X-HTTP-Method": "DELETE"
          },
          timeout: 10000
        }).then(() => {
          console.log(`[${timestamp}] [API unregister] Success`);
          return { success: true, message: "Unregistration successful!" };
        }).catch(xhr => {
          const msg = xhr.responseJSON?.error?.message?.value || "Failed to unregister";
          console.error(`[${timestamp}] [API unregister] Error:`, xhr);
          return { success: false, message: msg };
        });
      }).catch(xhr => {
        const msg = xhr.responseJSON?.error?.message?.value || "Failed to find registration";
        console.error(`[${timestamp}] [API unregister] Error:`, xhr);
        return { success: false, message: msg };
      });
    },

    getNextWaitlistPosition(site, eventId) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [API getNextWaitlistPosition] Event ID: ${eventId}`);
      const q = "?$select=WaitlistPosition&$filter=EventLookupId eq " + eventId + " and Status eq 'Waitlisted'&$orderby=WaitlistPosition desc";
      const url = site + "/_api/web/lists/getbytitle('Registrations')/items" + q;
      return $.ajax({
        url,
        headers: { Accept: "application/json; odata=verbose" },
        timeout: 10000
      }).then(d => {
        const maxPos = d.d?.results?.[0]?.WaitlistPosition || 0;
        console.log(`[${timestamp}] [API getNextWaitlistPosition] Next position: ${maxPos + 1}`);
        return maxPos + 1;
      }).catch(xhr => {
        console.error(`[${timestamp}] [API getNextWaitlistPosition] Error:`, xhr);
        return 1;
      });
    },

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

    loadSurveyResponses(site, surveyId) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [API loadSurveyResponses] Loading for surveyId: ${surveyId}`);
      const q = `?$select=Id,Title,SurveyJSON,EventTitles,SubmittedBy,SubmitDate&$filter=substringof('${surveyId}', EventTitles)`;
      const url = site + "/_api/web/lists/getbytitle('SurveyResponses')/items" + q;
      return $.ajax({
        url,
        headers: { Accept: "application/json; odata=verbose" },
        timeout: 15000
      }).then(d => {
        const responses = (d.d?.results || []).map(r => ({
          Id: r.Id,
          Title: r.Title,
          SurveyJSON: r.SurveyJSON,
          EventTitles: r.EventTitles,
          SubmittedBy: r.SubmittedBy,
          SubmitDate: r.SubmitDate
        }));
        console.log(`[${timestamp}] [API loadSurveyResponses] Loaded ${responses.length} responses`);
        return responses;
      }).catch(xhr => {
        let msg = "Failed to load survey responses.";
        if (xhr.status === 404) msg = "List 'SurveyResponses' not found.";
        if (xhr.status === 403) msg = "Access denied to SurveyResponses list.";
        return { error: true, message: msg };
      });
    }
  };

  // === COMPONENTS ===
  const components = {
    ErrorBoundary({ children }) {
      const [error, setError] = React.useState(null);
      React.useEffect(() => {
        if (error) {
          const timestamp = new Date().toISOString();
          console.error(`[${timestamp}] [ErrorBoundary] Render error:`, error);
          const root = document.getElementById('root');
          if (root) {
            root.innerHTML = '';
            ReactDOM.render(
              React.createElement("div", { className: "alert alert-danger" }, `Render error: ${error.message || "Unknown error"}`),
              root
            );
            console.log(`[${timestamp}] [ErrorBoundary] Fallback UI rendered`);
          }
        }
      }, [error]);
      try {
        return error ? null : children;
      } catch (e) {
        setError(e);
        return null;
      }
    },

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

    UnregModal({ showModal, unregId, setShowModal, handleConfirmUnreg }) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [UnregModal] Rendering, showModal: ${showModal}, unregId: ${unregId}`);
      if (!showModal) return null;

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
          React.createElement("div", { className: "modal-dialog", style: { margin: "10% auto", maxWidth: "500px" } },
            React.createElement("div", { className: "modal-content" },
              React.createElement("div", { className: "modal-header" },
                React.createElement("h4", { className: "modal-title" }, "Confirm Unregister"),
                React.createElement("button", { className: "close", onClick: () => setShowModal(false) }, "×")
              ),
              React.createElement("div", { className: "modal-body" },
                React.createElement("p", null, "Are you sure you want to unregister from this event?")
              ),
              React.createElement("div", { className: "modal-footer" },
                React.createElement("button", { className: "btn btn-default", onClick: () => setShowModal(false) }, "Close"),
                React.createElement("button", { className: "btn btn-danger", onClick: handleConfirmUnreg }, "Yes, Cancel")
              )
            )
          )
        )
      ];
    },

    SurveyModal({ showModal, setShowModal, events, site, digest }) {
      const timestamp = new Date().toISOString();
      const [survey, setSurvey] = React.useState(null);
      const [isDesigner, setIsDesigner] = React.useState(true);
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
      }, [showModal, events, site, digest]);

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
    },

    AdminLinks({ isAdmin, events, onDesignSurvey }) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [AdminLinks] Rendering, isAdmin: ${isAdmin}, events: ${events.length}`);
      if (!isAdmin) return null;

      const surveyId = events.length > 0 ? btoa(events.map(e => e.Title).join(',')).substring(0, 10) : '';

      return React.createElement("ul", { className: "nav nav-pills nav-stacked" },
        React.createElement("li", null,
          React.createElement("a", { href: "AdminDashboard.aspx", className: "btn btn-warning btn-block mb-2" }, "Admin Dashboard")
        ),
        React.createElement("li", null,
          React.createElement("a", { href: "Survey.aspx", className: "btn btn-info btn-block mb-2" }, "Design Survey")
        ),
        React.createElement("li", null,
          React.createElement("button", {
            className: "btn btn-primary btn-block mb-2",
            onClick: onDesignSurvey,
            disabled: events.length === 0
          }, "Design Event Survey")
        ),
        React.createElement("li", null,
          React.createElement("a", {
            href: surveyId ? `SurveyFiller.aspx?surveyId=${surveyId}` : '#',
            target: "_blank",
            className: `btn btn-info btn-block mb-2 ${surveyId ? '' : 'disabled'}`,
          }, "Form Filler")
        ),
        React.createElement("li", null,
          React.createElement("a", {
            href: surveyId ? `SurveyResponses.aspx?surveyId=${surveyId}` : '#',
            target: "_blank",
            className: `btn btn-secondary btn-block mb-2 ${surveyId ? '' : 'disabled'}`,
          }, "Response Page")
        )
      );
    },

    LoadingIndicator() {
      return React.createElement("div", {
        id: "loading",
        className: "alert alert-info text-center",
        style: { position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000 }
      }, "Loading...");
    }
  };

  // === MAIN APP ===
  const app = {
    validateDependencies() {
      const timestamp = new Date().toISOString();
      const checks = {
        jQuery: typeof $ === "function" ? "Loaded" : "Not loaded",
        React: typeof React !== "undefined" ? `Loaded ${React.version}` : "Not loaded",
        ReactDOM: typeof ReactDOM !== "undefined" ? "Loaded" : "Not loaded",
        render: typeof ReactDOM.render === "function" ? "Available" : "Not available",
        Survey: typeof Survey !== "undefined" ? "Loaded" : "Not loaded",
        SurveyCreator: typeof SurveyCreator !== "undefined" ? "Loaded" : "Not loaded"
      };
      console.log(`[${timestamp}] [validateDependencies] Check:`, checks);
      if (Object.values(checks).includes("Not loaded") || checks.render !== "Available") {
        throw new Error("Dependencies missing: " + JSON.stringify(checks));
      }
      if (React.version !== "17.0.2") {
        console.warn(`[${timestamp}] [validateDependencies] Unexpected React version: ${React.version}`);
      }
    },

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
                      ReactDOM.render(
                        React.createElement(components.AdminLinks, {
                          isAdmin,
                          events,
                          onDesignSurvey: () => handleDesignSurvey()
                        }),
                        adminRoot
                      );
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
            }, [events]); // Include events in dependencies to update AdminLinks

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

            const register = async (id) => {
              const timestamp = new Date().toISOString();
              console.log(`[${timestamp}] [register] Event ID: ${id}`);
              try {
                setLoading(true);
                const ev = events.find(e => e.Id === id);
                if (!ev) {
                  alert("Event not found.");
                  setLoading(false);
                  return;
                }
                if (!ev.AllowRegistration) {
                  alert("Registration closed.");
                  setLoading(false);
                  return;
                }
                const endDate = new Date(ev.EndTime);
                if (endDate.getTime() < Date.now()) {
                  alert("This event has ended.");
                  setLoading(false);
                  return;
                }
                const existing = await api.checkExistingRegistration(siteRef.current, id, userEmailRef.current);
                if (existing) {
                  alert(`You are already ${existing.Status === 'Confirmed' ? 'registered' : `waitlisted (#${existing.WaitlistPosition})`}`);
                  setLoading(false);
                  return;
                }
                digestRef.current = (await api.refreshDigest(siteRef.current))?.digest || digestRef.current;
                if (!digestRef.current) {
                  alert("Failed to refresh form digest.");
                  setLoading(false);
                  return;
                }
                const count = await api.getRegCount(siteRef.current, id);
                const full = ev.MaxSeats && count >= ev.MaxSeats;
                if (!full) {
                  const result = await api.createReg(siteRef.current, digestRef.current, id, userEmailRef.current, 'Confirmed', null, ev.Title);
                  alert(result.message);
                } else {
                  const pos = await api.getNextWaitlistPosition(siteRef.current, id);
                  if (confirm(`Event full. Join waitlist #${pos}?`)) {
                    const result = await api.createReg(siteRef.current, digestRef.current, id, userEmailRef.current, 'Waitlisted', pos, ev.Title);
                    alert(result.message);
                  } else {
                    alert("Waitlist registration cancelled.");
                  }
                }
                const [eventsData, regsData] = await Promise.all([
                  api.loadEvents(siteRef.current, digestRef.current),
                  api.loadMyRegs(siteRef.current, userEmailRef.current)
                ]);
                setEvents([...(eventsData.error ? [] : eventsData)]);
                setMyRegs([...(regsData.error ? [] : regsData)]);
                setLoading(false);
              } catch (e) {
                console.error(`[${timestamp}] [register] Error:`, e);
                alert("Failed to register. Check console.");
                setLoading(false);
              }
            };

            const showUnreg = (id) => {
              const timestamp = new Date().toISOString();
              console.log(`[${timestamp}] [showUnreg] Event ID: ${id}`);
              if (!Number.isInteger(id) || id <= 0) {
                alert("Invalid event ID.");
                return;
              }
              setUnregId(id);
              setShowModal(true);
            };

            const refreshMyRegs = async () => {
              const timestamp = new Date().toISOString();
              console.log(`[${timestamp}] [refreshMyRegs] Starting...`);
              setLoading(true);
              try {
                const regsData = await api.loadMyRegs(siteRef.current, userEmailRef.current);
                setMyRegs([...(regsData.error ? [] : regsData)]);
                setLoading(false);
              } catch (e) {
                console.error(`[${timestamp}] [refreshMyRegs] Error:`, e);
                alert("Failed to refresh registrations. Check console.");
                setLoading(false);
              }
            };

            const handleConfirmUnreg = async () => {
              const timestamp = new Date().toISOString();
              console.log(`[${timestamp}] [handleConfirmUnreg] Unreg ID: ${unregId}`);
              if (!Number.isInteger(unregId) || unregId <= 0) {
                alert("Invalid event ID.");
                setShowModal(false);
                return;
              }
              try {
                setLoading(true);
                setShowModal(false);
                digestRef.current = (await api.refreshDigest(siteRef.current))?.digest || digestRef.current;
                const result = await api.unregister(siteRef.current, digestRef.current, unregId, userEmailRef.current);
                alert(result.message);
                const [eventsData, regsData] = await Promise.all([
                  api.loadEvents(siteRef.current, digestRef.current),
                  api.loadMyRegs(siteRef.current, userEmailRef.current)
                ]);
                setEvents([...(eventsData.error ? [] : eventsData)]);
                setMyRegs([...(regsData.error ? [] : regsData)]);
                setUnregId(null);
                setLoading(false);
              } catch (e) {
                console.error(`[${timestamp}] [handleConfirmUnreg] Error:`, e);
                alert("Failed to unregister. Check console.");
                setLoading(false);
                setShowModal(false);
              }
            };

            const handleDesignSurvey = () => {
              if (events.length === 0) {
                alert("No events available for survey.");
                return;
              }
              setShowSurveyModal(true);
            };

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
                })
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
})(window, window.React, window.ReactDOM, window.jQuery, window.Survey, window.SurveyCreator);