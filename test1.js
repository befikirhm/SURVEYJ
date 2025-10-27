// app.js
if (typeof window.SP !== 'undefined' && window.SP.SOD) {
  window.SP.SOD.executeFunc('sp.js', 'SP.ClientContext', function() {
    // Ensure dependencies are loaded
    if (!window.React || !window.ReactDOM || !window.jQuery || !window.QRious) {
      console.error('Required libraries (React, ReactDOM, jQuery, QRious) not loaded.');
      return;
    }

    // Function to fetch request digest token for POST requests
    var getDigest = function() {
      return jQuery.ajax({
        type: 'POST',
        url: window._spPageContextInfo.webAbsoluteUrl + '/_api/contextinfo',
        headers: { "Accept": "application/json; odata=verbose" },
        xhrFields: { withCredentials: true }
      }).then(function(data) {
        return data.d.GetContextWebInformation.FormDigestValue;
      }).fail(function(error) {
        console.error('Error fetching digest:', error);
        throw new Error('Failed to fetch request digest token.');
      });
    };

    // Notification component for displaying messages
    class Notification extends React.Component {
      render() {
        var className = 'p-4 rounded shadow flex justify-between items-center ' +
          (this.props.type === 'success' ? 'bg-green-100 text-green-800' :
           this.props.type === 'warning' ? 'bg-yellow-100 text-yellow-800' :
           this.props.type === 'error' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800');
        return React.createElement('div', { className: className },
          React.createElement('span', null, this.props.message),
          React.createElement('button', {
            type: 'button',
            className: 'ml-4 text-lg font-bold',
            'aria-label': 'Close notification',
            onClick: this.props.onClose
          }, '\u00D7')
        );
      }
    }

    // TopNav component with logo, title, user name, and hamburger menu for mobile
    class TopNav extends React.Component {
      render() {
        return React.createElement('header', { className: 'fixed top-0 left-0 right-0 bg-blue-600 text-white p-4 flex justify-between items-center z-50' },
          React.createElement('div', { className: 'flex items-center' },
            React.createElement('img', { src: '/SiteAssets/logo.png', alt: 'Dashboard Logo', className: 'h-8 w-8 mr-2' }),
            React.createElement('h1', { className: 'text-xl font-bold' }, 'Survey Dashboard')
          ),
          React.createElement('div', { className: 'flex items-center' },
            React.createElement('span', { className: 'mr-4' }, this.props.username || 'Guest User'),
            React.createElement('button', {
              type: 'button',
              className: 'md:hidden p-2 rounded hover:bg-blue-700',
              onClick: this.props.toggleSideNav,
              'aria-label': 'Toggle side navigation'
            },
              React.createElement('svg', {
                className: 'w-6 h-6',
                fill: 'none',
                stroke: 'currentColor',
                viewBox: '0 0 24 24',
                xmlns: 'http://www.w3.org/2000/svg'
              },
                React.createElement('path', {
                  strokeLinecap: 'round',
                  strokeLinejoin: 'round',
                  strokeWidth: '2',
                  d: 'M4 6h16M4 12h16m-7 6h7'
                })
              )
            )
          )
        );
      }
    }

    // Custom SideNav component with search and filters, collapsible on small screens
    class SideNav extends React.Component {
      handleStatusChange(e) {
        var value = e.target.value;
        var newStatus = e.target.checked
          ? this.props.filters.status.concat([value])
          : this.props.filters.status.filter(s => s !== value);
        this.props.onFilterChange({ status: newStatus, search: this.props.filters.search });
      }
      render() {
        var _this = this;
        return React.createElement('nav', {
          className: 'fixed top-16 bottom-0 bg-gray-800 text-white w-64 p-4 space-y-4 overflow-y-auto transition-transform duration-300 ' +
            (this.props.isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0')
        },
          React.createElement('input', {
            type: 'text',
            placeholder: 'Search surveys...',
            className: 'w-full p-2 border rounded bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500',
            onChange: e => this.props.onFilterChange({ ...this.props.filters, search: e.target.value }),
            'aria-label': 'Search surveys'
          }),
          React.createElement('div', { className: 'space-y-2' },
            React.createElement('label', { className: 'flex items-center' },
              React.createElement('input', {
                type: 'checkbox',
                value: 'Publish',
                onChange: this.handleStatusChange.bind(this),
                className: 'mr-2',
                'aria-label': 'Filter by Published status'
              }, 'Published')
            ),
            React.createElement('label', { className: 'flex items-center' },
              React.createElement('input', {
                type: 'checkbox',
                value: 'Draft',
                onChange: this.handleStatusChange.bind(this),
                className: 'mr-2',
                'aria-label': 'Filter by Draft status'
              }, 'Draft')
            ),
            React.createElement('label', { className: 'flex items-center' },
              React.createElement('input', {
                type: 'checkbox',
                value: 'Upcoming',
                onChange: this.handleStatusChange.bind(this),
                className: 'mr-2',
                'aria-label': 'Filter by Upcoming status'
              }, 'Upcoming')
            ),
            React.createElement('label', { className: 'flex items-center' },
              React.createElement('input', {
                type: 'checkbox',
                value: 'Running',
                onChange: this.handleStatusChange.bind(this),
                className: 'mr-2',
                'aria-label': 'Filter by Running status'
              }, 'Running')
            ),
            React.createElement('label', { className: 'flex items-center' },
              React.createElement('input', {
                type: 'checkbox',
                value: 'Past',
                onChange: this.handleStatusChange.bind(this),
                className: 'mr-2',
                'aria-label': 'Filter by Past status'
              }, 'Past')
            )
          )
        );
      }
    }

    class SurveyCard extends React.Component {
      constructor(props) {
        super(props);
        this.state = { showQRModal: false, showEditModal: false };
        this.formatDate = this.formatDate.bind(this);
      }
      formatDate(date) {
        return date ? new Date(date).toLocaleDateString() : 'Not set';
      }
      render() {
        var _this = this;
        var formUrl = window._spPageContextInfo.webAbsoluteUrl + '/SitePages/filler.aspx?surveyId=' + this.props.survey.Id;
        return React.createElement('div', { className: 'border p-4 rounded shadow bg-white hover:shadow-lg transition flex flex-col' },
          React.createElement('div', { className: 'flex-1' },
            React.createElement('h2', { className: 'text-lg font-bold' }, this.props.survey.Title),
            React.createElement('p', { className: 'text-gray-600' }, this.props.survey.Description),
            React.createElement('div', { className: 'mt-2 space-y-2' },
              React.createElement('div', { className: 'flex flex-wrap gap-2' },
                this.props.survey.Owners && this.props.survey.Owners.results && this.props.survey.Owners.results.length > 0
                  ? this.props.survey.Owners.results.map(function(owner) {
                      return React.createElement('span', {
                        key: owner.Id,
                        className: 'bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm',
                        'aria-label': 'Owner: ' + owner.Title
                      }, owner.Title);
                    })
                  : React.createElement('p', { className: 'text-gray-500 text-sm' }, 'No owners assigned')
              ),
              React.createElement('div', null,
                React.createElement('span', {
                  className: 'bg-green-100 text-green-800 px-2 py-1 rounded-full text-sm',
                  'aria-label': 'Response count: ' + (this.props.survey.responseCount != null ? this.props.survey.responseCount : 'Error')
                }, 'Responses: ' + (this.props.survey.responseCount != null ? this.props.survey.responseCount : 'Error'))
              )
            ),
            React.createElement('p', null, 'Status: ' + this.props.survey.Status),
            React.createElement('p', null, 'Dates: ' + this.formatDate(this.props.survey.StartDate) + ' - ' + this.formatDate(this.props.survey.EndDate))
          ),
          React.createElement('div', { className: 'mt-4 flex flex-wrap gap-2 border-t pt-2' },
            [
              { class: 'bg-blue-500 hover:bg-blue-600', title: 'Edit the survey form', label: 'Edit survey form', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z', text: 'Edit Form', action: function() { window.open('builder.aspx?surveyId=' + _this.props.survey.Id, '_blank'); } },
              { class: 'bg-yellow-500 hover:bg-yellow-600', title: 'View survey report', label: 'View survey report', icon: 'M9 17v-2m0-2v-2m0-2V7m6 10v-2m0-2v-2m0-2V7m-6-2h6m4 0H5a2 2 0 00-2 2v12a2 2 0 002 2h14a2 2 0 002-2V7a2 2 0 00-2-2z', text: 'View Report', action: function() { window.open('report.aspx?surveyId=' + _this.props.survey.Id, '_blank'); } },
              { class: 'bg-purple-500 hover:bg-purple-600', title: 'Generate QR code', label: 'Generate QR code', icon: 'M12 4v1m6 11h2m-6 0h-2v4m0-11v3m-2 4h2M6 12H4m2 4v4m0-11v3m-2 4h2m7-7h3m-3 3h3m-3 3h3', text: 'QR Code', action: function(e) { e.preventDefault(); _this.setState({ showQRModal: true }); } },
              { class: 'bg-gray-500 hover:bg-gray-600', title: 'Edit survey metadata', label: 'Edit survey metadata', icon: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z', text: 'Edit Metadata', action: function() { _this.setState({ showEditModal: true }); } },
              { class: 'bg-green-500 hover:bg-green-600', title: 'Fill out the survey', label: 'Fill out survey', icon: 'M9 12l2 2 4-4M7.835 4.697a3.5 3.5 0 105.33 4.606 3.5 3.5 0 01-5.33-4.606zM12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707', text: 'Fill Form', action: function() { window.open('filler.aspx?surveyId=' + _this.props.survey.Id, '_blank'); } }
            ].map(function(btn) {
              return React.createElement('button', {
                type: 'button',
                className: 'flex items-center text-white px-3 py-1 rounded ' + btn.class,
                onClick: btn.action,
                title: btn.title,
                'aria-label': btn.label
              },
                React.createElement('svg', {
                  className: 'w-4 h-4 mr-1',
                  fill: 'none',
                  stroke: 'currentColor',
                  viewBox: '0 0 24 24',
                  xmlns: 'http://www.w3.org/2000/svg'
                },
                  React.createElement('path', {
                    strokeLinecap: 'round',
                    strokeLinejoin: 'round',
                    strokeWidth: '2',
                    d: btn.icon
                  })
                ),
                btn.text
              );
            })
          ),
          this.state.showQRModal && React.createElement(QRModal, {
            url: formUrl,
            surveyTitle: this.props.survey.Title,
            onClose: function() { _this.setState({ showQRModal: false }); },
            addNotification: this.props.addNotification
          }),
          this.state.showEditModal && React.createElement(EditModal, {
            survey: this.props.survey,
            onClose: function() { _this.setState({ showEditModal: false }); },
            addNotification: this.props.addNotification,
            currentUserId: this.props.currentUserId,
            loadSurveys: this.props.loadSurveys
          })
        );
      }
    }

    class QRModal extends React.Component {
      componentDidMount() {
        new window.QRious({ element: this.refs.qrCanvas, value: this.props.url, size: 200 });
      }
      downloadQR() {
        var sanitizedTitle = (this.props.surveyTitle || 'survey')
          .replace(/[^a-zA-Z0-9-_]/g, '_')
          .replace(/_+/g, '_')
          .trim('_');
        var filename = sanitizedTitle + '-qrcode.png';
        var link = document.createElement('a');
        link.href = this.refs.qrCanvas.toDataURL();
        link.download = filename;
        link.click();
      }
      render() {
        var _this = this;
        return React.createElement('div', {
          className: 'fixed inset-0 flex items-center justify-center z-1000 bg-black/50'
        },
          React.createElement('div', {
            className: 'bg-white rounded-lg shadow-xl w-11/12 max-w-md sm:max-w-lg md:max-w-xl'
          },
            React.createElement('div', {
              className: 'flex justify-between items-center p-4 border-b bg-gray-100'
            },
              React.createElement('h2', {
                className: 'text-lg font-bold text-gray-800 truncate',
                title: this.props.surveyTitle
              }, this.props.surveyTitle || 'Survey QR Code'),
              React.createElement('button', {
                type: 'button',
                className: 'text-gray-600 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full w-8 h-8 flex items-center justify-center',
                onClick: this.props.onClose,
                'aria-label': 'Close QR code modal'
              }, '\u00D7')
            ),
            React.createElement('div', {
              className: 'p-6 flex justify-center items-center'
            },
              React.createElement('canvas', {
                ref: function(el) { _this.refs = _this.refs || {}; _this.refs.qrCanvas = el; },
                className: 'max-w-full h-auto'
              })
            ),
            React.createElement('div', {
              className: 'flex flex-wrap gap-3 justify-end p-4 border-t bg-gray-50'
            },
              React.createElement('button', {
                type: 'button',
                className: 'bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition',
                onClick: this.downloadQR.bind(this),
                'aria-label': 'Download QR code'
              }, 'Download'),
              React.createElement('button', {
                type: 'button',
                className: 'bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 transition',
                onClick: function() { navigator.clipboard.writeText(_this.props.url).then(function() { _this.props.addNotification('URL copied to clipboard!'); }); },
                'aria-label': 'Copy QR code URL'
              }, 'Copy URL'),
              React.createElement('button', {
                type: 'button',
                className: 'bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 transition',
                onClick: this.props.onClose,
                'aria-label': 'Close modal'
              }, 'Close')
            )
          )
        );
      }
    }

    class App extends React.Component {
      constructor(props) {
        super(props);
        this.state = {
          surveys: [],
          userRole: '',
          currentUser: null,
          isSiteAdmin: false,
          filters: { search: '', dateFilter: 'all' },
          isLoadingUser: true,
          isLoadingSurveys: false,
          notifications: [],
          userLoaded: false,
          isSideNavOpen: false
        };
        this.addNotification = this.addNotification.bind(this);
        this.loadCurrentUser = this.loadCurrentUser.bind(this);
        this.tryRestUser = this.tryRestUser.bind(this);
        this.fetchUserDetails = this.fetchUserDetails.bind(this);
        this.loadSurveys = this.loadSurveys.bind(this);
        this.applyFilters = this.applyFilters.bind(this);
        this.toggleSideNav = this.toggleSideNav.bind(this);
      }
      componentDidMount() {
        this._isMounted = true;
        console.log('componentDidMount: Starting user load...');
        if (!window._spPageContextInfo) {
          console.error('componentDidMount: _spPageContextInfo is undefined');
          this.addNotification('SharePoint page context unavailable. Ensure this is a SharePoint page.', 'error');
          this.setState({ isLoadingUser: false });
          return;
        }
        this.loadCurrentUser();
      }
      componentWillUnmount() {
        this._isMounted = false;
      }
      addNotification(message, type) {
        var id = Date.now();
        var _this = this;
        this.setState(function(prevState) {
          return { notifications: prevState.notifications.concat([{ id: id, message: message, type: type || 'success' }]) };
        });
        setTimeout(function() {
          if (!_this._isMounted) return;
          _this.setState(function(prevState) {
            return { notifications: prevState.notifications.filter(function(n) { return n.id !== id; }) };
          });
        }, 5000);
      }
      loadCurrentUser(retryCount = 0, maxRetries = 3, delay = 1000) {
        console.log('loadCurrentUser: Attempt', retryCount + 1);
        var _this = this;
        if (typeof window.SP !== 'undefined' && window.SP.SOD) {
          window.SP.SOD.executeFunc('sp.js', 'SP.ClientContext', function() {
            console.log('sp.js loaded, initializing CSOM...');
            var context = window.SP.ClientContext.get_current();
            if (!context) {
              console.error('SP.ClientContext is undefined');
              _this.tryRestUser(retryCount, maxRetries, delay);
              return;
            }
            var user = context.get_web().get_currentUser();
            if (!user) {
              console.error('Current user object is undefined');
              _this.tryRestUser(retryCount, maxRetries, delay);
              return;
            }
            context.load(user);
            context.executeQueryAsync(
              function() {
                console.log('CSOM user loaded:', user.get_title(), user.get_id());
                _this.setState({ currentUser: user });
                _this.fetchUserDetails(user);
              },
              function(sender, args) {
                console.error('CSOM error loading user:', args.get_message(), args.get_stackTrace());
                _this.tryRestUser(retryCount, maxRetries, delay);
              }
            );
          });
        } else {
          console.warn('SP.SOD undefined, using REST API...');
          this.tryRestUser(retryCount, maxRetries, delay);
        }
      }
      tryRestUser(retryCount, maxRetries, delay) {
        var _this = this;
        jQuery.ajax({
          url: window._spPageContextInfo.webAbsoluteUrl + '/_api/web/currentuser?$select=Id,Title,IsSiteAdmin',
          headers: { "Accept": "application/json; odata=verbose" },
          xhrFields: { withCredentials: true }
        }).then(function(userData) {
          console.log('REST API user data:', userData.d);
          _this.setState({
            currentUser: { Id: userData.d.Id, get_id: function() { return userData.d.Id; }, get_title: function() { return userData.d.Title; } }
          });
          _this.fetchUserDetails({ Id: userData.d.Id, get_id: function() { return userData.d.Id; }, get_title: function() { return userData.d.Title; } });
        }).fail(function(error) {
          console.error('REST API error loading user:', { status: error.status, statusText: error.statusText, responseText: error.responseText });
          if (retryCount < maxRetries - 1) {
            console.log('Retrying REST user load in ' + delay + 'ms...');
            setTimeout(function() { _this.loadCurrentUser(retryCount + 1, maxRetries, delay * 2); }, delay);
          } else {
            console.error('Failed to load user after', maxRetries, 'attempts');
            this.addNotification('Failed to load user information after multiple attempts.', 'error');
            _this.setState({
              currentUser: { Id: 0, get_id: function() { return 0; }, get_title: function() { return 'Guest User'; } },
              userRole: 'member',
              isSiteAdmin: false,
              userLoaded: true,
              isLoadingUser: false
            });
            _this.loadSurveys();
          }
        });
      }
      fetchUserDetails(user) {
        var _this = this;
        jQuery.ajax({
          url: window._spPageContextInfo.webAbsoluteUrl + '/_api/web/currentuser?$select=Id,IsSiteAdmin',
          headers: { "Accept": "application/json; odata=verbose" },
          xhrFields: { withCredentials: true }
        }).then(function(userData) {
          console.log('REST API user details:', userData.d);
          _this.setState({ isSiteAdmin: userData.d.IsSiteAdmin });
          return jQuery.ajax({
            url: window._spPageContextInfo.webAbsoluteUrl + '/_api/web/currentuser/groups',
            headers: { "Accept": "application/json; odata=verbose" },
            xhrFields: { withCredentials: true }
          });
        }).then(function(groupData) {
          console.log('User groups:', groupData.d.results);
          var isOwnerGroup = groupData.d.results.some(function(g) { return g.Title.includes('Owners'); });
          _this.setState({
            userRole: _this.state.isSiteAdmin || isOwnerGroup ? 'owner' : 'member',
            userLoaded: true,
            isLoadingUser: false
          });
          _this.loadSurveys();
        }).fail(function(error) {
          console.error('Error fetching user details:', { status: error.status, statusText: error.statusText, responseText: error.responseText });
          _this.addNotification('Failed to load user permissions or groups.', 'error');
          _this.setState({
            userRole: 'member',
            isSiteAdmin: false,
            userLoaded: true,
            isLoadingUser: false
          });
          _this.loadSurveys();
        });
      }
      loadSurveys(retryCount = 0, maxRetries = 5, delay = 2000) {
        if (!this.state.currentUser || !this.state.userLoaded) {
          console.error('loadSurveys: currentUser is undefined or user not fully loaded');
          this.addNotification('Cannot load surveys: User information not available.', 'error');
          this.setState({ isLoadingSurveys: false });
          return;
        }
        var userId = this.state.currentUser.get_id ? this.state.currentUser.get_id() : this.state.currentUser.Id;
        if (!userId) {
          console.error('loadSurveys: userId is undefined');
          this.addNotification('Cannot load surveys: User ID not available.', 'error');
          this.setState({ isLoadingSurveys: false });
          return;
        }
        var _this = this;
        this.setState({ isLoadingSurveys: true });
        console.log('Loading surveys for userId:', userId, 'isSiteAdmin:', this.state.isSiteAdmin, 'attempt:', retryCount + 1);
        var selectFields = 'Id,Title,Owners/Id,Owners/Title,Author/Id,Author/Title,StartDate,EndDate,Status';
        var filter = this.state.isSiteAdmin ? '' : '&$filter=Owners/Id eq ' + userId + ' or Author/Id eq ' + userId;

        jQuery.ajax({
          url: window._spPageContextInfo.webAbsoluteUrl + '/_api/web/lists/getbytitle(\'Surveys\')/items?$select=' + selectFields + '&$expand=Owners,Author' + filter,
          headers: { "Accept": "application/json; odata=verbose" },
          xhrFields: { withCredentials: true }
        }).then(function(response) {
          console.log('Surveys API response (attempt ' + (retryCount + 1) + '):', response.d.results);
          if (!response.d.results) {
            console.error('Surveys API response.results is undefined');
            _this.addNotification('Survey data unavailable. API returned undefined results.', 'error');
            _this.setState({ isLoadingSurveys: false });
            return;
          }
          var surveys = response.d.results.map(function(s) {
            return Object.assign({}, s, {
              Owners: { results: s.Owners ? s.Owners.results || [] : [] },
              Description: 'No description available'
            });
          });
          Promise.all(surveys.map(function(s) {
            return jQuery.ajax({
              url: window._spPageContextInfo.webAbsoluteUrl + '/_api/web/lists/getbytitle(\'SurveyResponses\')/items?$select=Id,SurveyID/Id&$expand=SurveyID&$filter=SurveyID/Id eq ' + s.Id + '&$top=1000',
              headers: { "Accept": "application/json; odata=verbose" },
              xhrFields: { withCredentials: true }
            }).then(function(res) {
              console.log('Response API result for survey ' + s.Id + ':', res.d.results);
              var count = res.d.__count !== undefined ? parseInt(res.d.__count, 10) : res.d.results.length || 0;
              if (!res.d.results || res.d.results.length === 0) {
                console.warn('No responses found for survey ' + s.Id + '.');
              }
              return Object.assign({}, s, { responseCount: count });
            }).fail(function(error) {
              console.error('Error fetching responses for survey ' + s.Id + ':', {
                status: error.status,
                statusText: error.statusText,
                responseText: error.responseText
              });
              _this.addNotification('Failed to load response count for survey "' + s.Title + '". Error: ' + (error.statusText || 'Unknown error'), 'error');
              return Object.assign({}, s, { responseCount: null });
            });
          })).then(function(updatedSurveys) {
            console.log('Updated surveys:', updatedSurveys);
            _this.setState({ surveys: updatedSurveys, isLoadingSurveys: false });
            if (updatedSurveys.length === 0) {
              _this.addNotification('No surveys found for user ID ' + userId + '. Ensure you are an owner or creator.', 'warning');
            }
          });
        }).fail(function(error) {
          console.error('Error fetching surveys (attempt ' + (retryCount + 1) + '):', error);
          if (retryCount < maxRetries - 1) {
            console.log('Retrying loadSurveys in ' + delay + 'ms...');
            setTimeout(function() { _this.loadSurveys(retryCount + 1, maxRetries, delay * 2); }, delay);
          } else {
            _this.addNotification('Failed to load surveys after ' + maxRetries + ' attempts. Error: ' + (error.responseText || 'Unknown error'), 'error');
            _this.setState({ isLoadingSurveys: false });
          }
        });
      }
      applyFilters(survey) {
        var search = this.state.filters.search;
        var dateFilter = this.state.filters.dateFilter;
        var today = new Date();
        today.setHours(0, 0, 0, 0);
        var matchesSearch = !search || survey.Title.toLowerCase().includes(search.toLowerCase());
        var startDate = survey.StartDate ? new Date(survey.StartDate) : null;
        var endDate = survey.EndDate ? new Date(survey.EndDate) : null;
        var matchesDate = true;

        if (dateFilter === 'upcoming') {
          matchesDate = startDate && startDate > today;
        } else if (dateFilter === 'past') {
          matchesDate = endDate && endDate < today;
        } else if (dateFilter === 'running') {
          matchesDate = startDate && endDate && startDate <= today && endDate >= today;
        }

        return matchesSearch && matchesDate;
      }
      toggleSideNav() {
        this.setState({ isSideNavOpen: !this.state.isSideNavOpen });
      }
      render() {
        var _this = this;
        if (this.state.isLoadingUser) {
          return React.createElement('div', { className: 'flex items-center justify-center h-screen' },
            React.createElement('div', { className: 'animate-spin rounded-full h-12 w-12 border-t-4 border-blue-500' })
          );
        }
        var filteredSurveys = this.state.surveys.filter(this.applyFilters.bind(this));
        return React.createElement('div', { className: 'flex flex-col h-screen' },
          React.createElement('div', { className: 'fixed top-4 right-4 z-60 space-y-2' },
            this.state.notifications.map(function(n) {
              return React.createElement(Notification, {
                key: n.id,
                message: n.message,
                type: n.type,
                onClose: function() { _this.setState({ notifications: _this.state.notifications.filter(function(notification) { return notification.id !== n.id; }) }); }
              });
            })
          ),
          React.createElement(TopNav, {
            username: this.state.currentUser && this.state.currentUser.get_title ? this.state.currentUser.get_title() : 'Guest User',
            toggleSideNav: this.toggleSideNav.bind(this)
          }),
          React.createElement('div', { className: 'flex flex-1 pt-16' },
            React.createElement(SideNav, {
              filters: this.state.filters,
              onFilterChange: function(newFilters) { _this.setState({ filters: newFilters }); },
              isOpen: this.state.isSideNavOpen,
              toggle: this.toggleSideNav.bind(this)
            }),
            React.createElement('main', { className: 'flex-1 p-4 ml-0 md:ml-64 transition-all duration-300' },
              React.createElement('div', { className: 'mb-4' },
                React.createElement('button', {
                  type: 'button',
                  onClick: function() { window.open('builder.aspx', '_blank'); },
                  className: 'bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600',
                  'aria-label': 'Create new survey form'
                }, 'Create New Form')
              ),
              this.state.isLoadingSurveys
                ? React.createElement('div', { className: 'flex items-center justify-center h-full' },
                    React.createElement('div', { className: 'animate-spin rounded-full h-12 w-12 border-t-4 border-blue-500 mr-4' }),
                    React.createElement('span', null, 'Loading surveys...')
                  )
                : filteredSurveys.length === 0
                  ? React.createElement('div', { className: 'flex items-center justify-center h-full' },
                      React.createElement('span', { className: 'text-gray-500' }, 'No surveys available')
                    )
                  : React.createElement('div', { className: 'grid grid-cols-1 lg:grid-cols-2 gap-4' },
                      filteredSurveys.map(function(survey) {
                        return React.createElement(SurveyCard, {
                          key: survey.Id,
                          survey: survey,
                          userRole: _this.state.userRole,
                          currentUserId: _this.state.currentUser && (_this.state.currentUser.get_id ? _this.state.currentUser.get_id() : _this.state.currentUser.Id),
                          addNotification: _this.addNotification.bind(_this),
                          loadSurveys: _this.loadSurveys.bind(_this)
                        });
                      })
                    )
            )
          )
        );
      }
    }

    // Ensure root element exists
    var rootElement = document.getElementById('root');
    if (!rootElement) {
      console.error('Root element with ID "root" not found.');
      return;
    }
    ReactDOM.render(React.createElement(App), rootElement);
  });
} else {
  console.error('SP.SOD is undefined. Ensure this is running in a SharePoint context.');
}