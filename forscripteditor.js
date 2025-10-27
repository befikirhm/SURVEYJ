// app.js
$(document).ready(function() {
  // Ensure dependencies are loaded
  if (!window.React || !window.ReactDOM || !window.jQuery || !window.QRious) {
    console.error('Required libraries (React, ReactDOM, jQuery, QRious) not loaded.');
    return;
  }

  // Hide SharePoint out-of-the-box left navigation
  var style = document.createElement('style');
  style.innerHTML = `
    #sideNavBox { display: none !important; }
    #contentBox { margin-left: 0 !important; }
  `;
  document.head.appendChild(style);

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

  class Notification extends React.Component {
    render() {
      var className = 'p-4 rounded shadow flex justify-between items-center ' +
        (this.props.type === 'success' ? 'bg-green-100 text-green-800' :
         this.props.type === 'warning' ? 'bg-yellow-100 text-yellow-800' :
         this.props.type === 'error' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800');
      return React.createElement('div', { className: className },
        React.createElement('span', null, this.props.message),
        React.createElement('button', {
          className: 'ml-4 text-lg font-bold',
          'aria-label': 'Close notification',
          onClick: this.props.onClose
        }, '\u00D7')
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
          React.createElement('div', { className: 'mt-2 flex flex-wrap gap-2' },
            this.props.survey.Owners && this.props.survey.Owners.results && this.props.survey.Owners.results.length > 0
              ? this.props.survey.Owners.results.map(function(owner) {
                  return React.createElement('span', {
                    key: owner.Id,
                    className: 'bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm',
                    'aria-label': 'Owner: ' + owner.Title
                  }, owner.Title);
                })
              : React.createElement('p', { className: 'text-gray-500 text-sm' }, 'No owners assigned'),
            React.createElement('span', {
              className: 'bg-green-100 text-green-800 px-2 py-1 rounded-full text-sm',
              'aria-label': 'Response count: ' + (this.props.survey.responseCount != null ? this.props.survey.responseCount : 'Error')
            }, 'Responses: ' + (this.props.survey.responseCount != null ? this.props.survey.responseCount : 'Error'))
          ),
          React.createElement('p', null, 'Status: ' + this.props.survey.Status + (this.props.survey.Archive ? ' (Archived)' : '')),
          React.createElement('p', null, 'Dates: ' + this.formatDate(this.props.survey.StartDate) + ' - ' + this.formatDate(this.props.survey.EndDate))
        ),
        React.createElement('div', { className: 'mt-4 flex flex-wrap gap-2 border-t pt-2' },
          [
            { class: 'bg-blue-500 hover:bg-blue-600', title: 'Edit the survey form', label: 'Edit survey form', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z', text: 'Edit Form', action: function() { window.open('builder.aspx?surveyId=' + _this.props.survey.Id, '_blank'); } },
            { class: 'bg-yellow-500 hover:bg-yellow-600', title: 'View survey report', label: 'View survey report', icon: 'M9 17v-2m0-2v-2m0-2V7m6 10v-2m0-2v-2m0-2V7m-6-2h6m4 0H5a2 2 0 00-2 2v12a2 2 0 002 2h14a2 2 0 002-2V7a2 2 0 00-2-2z', text: 'View Report', action: function() { window.open('report.aspx?surveyId=' + _this.props.survey.Id, '_blank'); } },
            { class: 'bg-purple-500 hover:bg-purple-600', title: 'Generate QR code', label: 'Generate QR code', icon: 'M12 4v1m6 11h2m-6 0h-2v4m0-11v3m-2 4h2M6 12H4m2 4v4m0-11v3m-2 4h2m7-7h3m-3 3h3m-3 3h3', text: 'QR Code', action: function() { _this.setState({ showQRModal: true }); } },
            { class: 'bg-gray-500 hover:bg-gray-600', title: 'Edit survey metadata', label: 'Edit survey metadata', icon: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z', text: 'Edit Metadata', action: function() { _this.setState({ showEditModal: true }); } },
            { class: 'bg-green-500 hover:bg-green-600', title: 'Fill out the survey', label: 'Fill out survey', icon: 'M9 12l2 2 4-4M7.835 4.697a3.5 3.5 0 105.33 4.606 3.5 3.5 0 01-5.33-4.606zM12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707', text: 'Fill Form', action: function() { window.open('filler.aspx?surveyId=' + _this.props.survey.Id, '_blank'); } }
          ].map(function(btn) {
            return React.createElement('button', {
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
      var link = document.createElement('a');
      link.href = this.refs.qrCanvas.toDataURL();
      link.download = 'qrcode.png';
      link.click();
    }
    render() {
      var _this = this;
      return React.createElement('div', { className: 'fixed inset-0 flex items-center justify-center z-50' },
        React.createElement('div', { className: 'bg-white rounded-lg shadow-xl w-full max-w-md' },
          React.createElement('div', { className: 'flex justify-between items-center p-4 border-b' },
            React.createElement('h2', { className: 'text-lg font-bold' }, 'QR Code'),
            React.createElement('button', {
              className: 'text-gray-600 hover:text-gray-800',
              onClick: this.props.onClose,
              'aria-label': 'Close QR code modal'
            }, '\u00D7')
          ),
          React.createElement('div', { className: 'p-6' },
            React.createElement('canvas', { ref: function(el) { _this.refs = _this.refs || {}; _this.refs.qrCanvas = el; }, className: 'mx-auto' })
          ),
          React.createElement('div', { className: 'flex gap-2 justify-end p-4 border-t' },
            React.createElement('button', {
              className: 'bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600',
              onClick: this.downloadQR.bind(this),
              'aria-label': 'Download QR code'
            }, 'Download'),
            React.createElement('button', {
              className: 'bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600',
              onClick: function() { navigator.clipboard.writeText(_this.props.url).then(function() { _this.props.addNotification('URL copied to clipboard!'); }); },
              'aria-label': 'Copy QR code URL'
            }, 'Copy URL'),
            React.createElement('button', {
              className: 'bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600',
              onClick: this.props.onClose,
              'aria-label': 'Close modal'
            }, 'Close')
          )
        )
      );
    }
  }

  class EditModal extends React.Component {
    constructor(props) {
      super(props);
      this.state = {
        form: {
          Owners: Array.isArray(this.props.survey.Owners?.results)
            ? this.props.survey.Owners.results.map(function(o) { return { Id: o.Id, Title: o.Title }; })
            : [],
          StartDate: this.props.survey.StartDate ? new Date(this.props.survey.StartDate).toISOString().split('T')[0] : '',
          EndDate: this.props.survey.EndDate ? new Date(this.props.survey.EndDate).toISOString().split('T')[0] : '',
          Status: this.props.survey.Status || 'Draft',
          Archive: this.props.survey.Archive || false
        },
        searchTerm: '',
        searchResults: [],
        isLoadingUsers: false,
        isSaving: false,
        showDropdown: false
      };
      this.handleUserSelect = this.handleUserSelect.bind(this);
      this.handleUserRemove = this.handleUserRemove.bind(this);
      this.handleSave = this.handleSave.bind(this);
    }
    componentDidMount() {
      this._isMounted = true;
    }
    componentWillUnmount() {
      this._isMounted = false;
      clearTimeout(this._debounce);
    }
    componentDidUpdate(prevProps, prevState) {
      var _this = this;
      if (prevState.searchTerm !== this.state.searchTerm) {
        if (!this.state.searchTerm) {
          this.setState({ searchResults: [], showDropdown: false });
          return;
        }
        clearTimeout(this._debounce);
        this._debounce = setTimeout(function() {
          _this.setState({ isLoadingUsers: true });
          jQuery.ajax({
            url: window._spPageContextInfo.webAbsoluteUrl + '/_api/web/siteusers?$select=Id,Title&$filter=substringof(\'' + encodeURIComponent(_this.state.searchTerm) + '\',Title)&$top=10',
            headers: { "Accept": "application/json; odata=verbose" },
            xhrFields: { withCredentials: true },
            success: function(data) {
              if (!_this._isMounted) return;
              var users = data.d.results.filter(function(u) { return u.Id && u.Title; }).map(function(u) { return { Id: u.Id, Title: u.Title }; });
              var availableUsers = users.filter(function(u) { return !_this.state.form.Owners.some(function(selected) { return selected.Id === u.Id; }); });
              _this.setState({ searchResults: availableUsers, isLoadingUsers: false, showDropdown: true });
            },
            error: function(xhr, status, error) {
              if (!_this._isMounted) return;
              console.error('Error searching users:', error);
              _this.props.addNotification('Failed to search users.', 'error');
              _this.setState({ isLoadingUsers: false, showDropdown: false });
            }
          });
        }, 300);
      }
    }
    handleUserSelect(user) {
      this.setState({
        form: Object.assign({}, this.state.form, { Owners: this.state.form.Owners.concat([user]) }),
        searchTerm: '',
        showDropdown: false
      });
    }
    handleUserRemove(userId) {
      if (userId === this.props.currentUserId) {
        this.props.addNotification('You cannot remove yourself as an owner.', 'error');
        return;
      }
      this.setState({
        form: Object.assign({}, this.state.form, {
          Owners: this.state.form.Owners.filter(function(o) { return o.Id !== userId; })
        })
      });
    }
    handleSave() {
      var _this = this;
      if (!this.state.form.Owners.some(function(o) { return o.Id === _this.props.currentUserId; })) {
        this.props.addNotification('You must remain an owner of the survey.', 'error');
        return;
      }
      this.setState({ isSaving: true });
      getDigest().then(function(digest) {
        var payload = {
          '__metadata': { 'type': 'SP.Data.SurveysListItem' },
          OwnersId: { results: _this.state.form.Owners.map(function(o) { return o.Id; }) },
          Status: _this.state.form.Status,
          Archive: _this.state.form.Archive
        };
        if (_this.state.form.StartDate) payload.StartDate = new Date(_this.state.form.StartDate).toISOString();
        if (_this.state.form.EndDate) payload.EndDate = new Date(_this.state.form.EndDate).toISOString();
        console.log('Saving metadata for survey:', _this.props.survey.Id, payload);
        jQuery.ajax({
          url: window._spPageContextInfo.webAbsoluteUrl + '/_api/web/lists/getbytitle(\'Surveys\')/items(' + _this.props.survey.Id + ')',
          type: 'POST',
          data: JSON.stringify(payload),
          headers: {
            "X-HTTP-Method": "MERGE",
            "If-Match": "*",
            "Accept": "application/json; odata=verbose",
            "Content-Type": "application/json; odata=verbose",
            "X-RequestDigest": digest
          },
          xhrFields: { withCredentials: true }
        }).then(function() {
          return jQuery.ajax({
            url: window._spPageContextInfo.webAbsoluteUrl + '/_api/web/lists/getbytitle(\'Surveys\')/items(' + _this.props.survey.Id + ')/effectiveBasePermissions',
            headers: { "Accept": "application/json; odata=verbose" },
            xhrFields: { withCredentials: true }
          });
        }).then(function(permissions) {
          var hasManagePermissions = permissions.d.EffectiveBasePermissions.High & 0x00000080;
          if (hasManagePermissions) {
            return jQuery.ajax({
              url: window._spPageContextInfo.webAbsoluteUrl + '/_api/web/lists/getbytitle(\'Surveys\')/items(' + _this.props.survey.Id + ')/breakroleinheritance(copyRoleAssignments=false, clearSubscopes=true)',
              type: 'POST',
              headers: {
                "Accept": "application/json; odata=verbose",
                "X-RequestDigest": digest
              },
              xhrFields: { withCredentials: true }
            }).then(function() {
              if (_this.state.form.Owners.length > 0) {
                return Promise.all(_this.state.form.Owners.map(function(user) {
                  return jQuery.ajax({
                    url: window._spPageContextInfo.webAbsoluteUrl + '/_api/web/lists/getbytitle(\'Surveys\')/items(' + _this.props.survey.Id + ')/roleassignments/addroleassignment(principalid=' + user.Id + ', roledefid=1073741827)',
                    type: 'POST',
                    headers: {
                      "Accept": "application/json; odata=verbose",
                      "X-RequestDigest": digest
                    },
                    xhrFields: { withCredentials: true }
                  });
                }));
              }
            });
          } else {
            _this.props.addNotification('Survey metadata updated. Permissions not modified due to insufficient access.', 'warning');
          }
        }).then(function() {
          _this.props.addNotification('Survey metadata and permissions updated successfully!');
          console.log('Metadata save successful for survey:', _this.props.survey.Id);
          _this.props.loadSurveys();
          _this.props.onClose();
          _this.setState({ isSaving: false });
        }).fail(function(error) {
          console.error('Error updating survey:', error);
          var errorMessage = error.responseText || error.message || 'Unknown error';
          if (error.status === 403) errorMessage = 'Access denied. Ensure you have Manage Permissions on this survey.';
          else if (errorMessage.includes('Invalid Form Digest')) errorMessage = 'Invalid or expired request digest token. Please try again.';
          _this.props.addNotification('Failed to update survey: ' + errorMessage, 'error');
          _this.setState({ isSaving: false });
        });
      }).fail(function(error) {
        console.error('Error getting digest:', error);
        _this.props.addNotification('Failed to update survey: Unable to get request digest.', 'error');
        _this.setState({ isSaving: false });
      });
    }
    render() {
      var _this = this;
      return React.createElement('div', { className: 'fixed inset-0 flex items-center justify-center z-50' },
        React.createElement('div', { className: 'bg-white rounded-lg shadow-xl w-full max-w-md' },
          React.createElement('div', { className: 'flex justify-between items-center p-4 border-b' },
            React.createElement('h2', { className: 'text-lg font-bold' }, 'Edit Metadata'),
            React.createElement('button', {
              className: 'text-gray-600 hover:text-gray-800',
              onClick: this.props.onClose,
              'aria-label': 'Close metadata modal'
            }, '\u00D7')
          ),
          React.createElement('div', { className: 'p-6 max-h-96 overflow-y-auto' },
            React.createElement('div', { className: 'space-y-4' },
              React.createElement('div', null,
                React.createElement('label', { className: 'block mb-1' }, 'Owners'),
                React.createElement('div', { className: 'relative' },
                  React.createElement('input', {
                    type: 'text',
                    value: this.state.searchTerm,
                    onChange: function(e) { _this.setState({ searchTerm: e.target.value }); },
                    placeholder: 'Search for users by name...',
                    className: 'w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500',
                    'aria-label': 'Search for users'
                  }),
                  this.state.isLoadingUsers && React.createElement('div', { className: 'absolute top-2 right-2' },
                    React.createElement('div', { className: 'animate-spin rounded-full h-5 w-5 border-t-2 border-blue-500' })
                  ),
                  this.state.showDropdown && this.state.searchResults.length > 0 && React.createElement('ul', {
                    className: 'absolute z-10 w-full bg-white border rounded mt-1 max-h-48 overflow-y-auto shadow-lg'
                  },
                    this.state.searchResults.map(function(user) {
                      return React.createElement('li', {
                        key: user.Id,
                        onClick: function() { _this.handleUserSelect(user); },
                        className: 'p-2 hover:bg-gray-100 cursor-pointer border-b last:border-b-0',
                        role: 'option',
                        'aria-selected': 'false'
                      }, user.Title);
                    })
                  )
                ),
                React.createElement('div', { className: 'mt-2 flex flex-wrap gap-2' },
                  this.state.form.Owners.length === 0
                    ? React.createElement('p', { className: 'text-gray-500 text-sm' }, 'No owners selected')
                    : this.state.form.Owners.map(function(user) {
                        return React.createElement('div', {
                          key: user.Id,
                          className: 'flex items-center bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm'
                        },
                          React.createElement('span', null, user.Title),
                          React.createElement('button', {
                            onClick: function() { _this.handleUserRemove(user.Id); },
                            className: 'ml-2 text-red-600 hover:text-red-800 font-bold',
                            disabled: user.Id === _this.props.currentUserId,
                            'aria-label': 'Remove ' + user.Title + ' from owners'
                          }, user.Id === _this.props.currentUserId ? '' : '\u00D7')
                        );
                      })
                )
              ),
              React.createElement('div', null,
                React.createElement('label', { className: 'block mb-1' }, 'Start Date'),
                React.createElement('input', {
                  type: 'date',
                  value: this.state.form.StartDate,
                  onChange: function(e) { _this.setState({ form: Object.assign({}, _this.state.form, { StartDate: e.target.value }) }); },
                  className: 'w-full p-2 border rounded',
                  'aria-label': 'Start date'
                })
              ),
              React.createElement('div', null,
                React.createElement('label', { className: 'block mb-1' }, 'End Date'),
                React.createElement('input', {
                  type: 'date',
                  value: this.state.form.EndDate,
                  onChange: function(e) { _this.setState({ form: Object.assign({}, _this.state.form, { EndDate: e.target.value }) }); },
                  className: 'w-full p-2 border rounded',
                  'aria-label': 'End date'
                })
              ),
              React.createElement('div', null,
                React.createElement('label', { className: 'block mb-1' }, 'Status'),
                React.createElement('select', {
                  value: this.state.form.Status,
                  onChange: function(e) { _this.setState({ form: Object.assign({}, _this.state.form, { Status: e.target.value }) }); },
                  className: 'w-full p-2 border rounded',
                  'aria-label': 'Survey status'
                },
                  React.createElement('option', { value: 'Publish' }, 'Publish'),
                  React.createElement('option', { value: 'Draft' }, 'Draft')
                )
              ),
              React.createElement('div', null,
                React.createElement('label', { className: 'flex items-center' },
                  React.createElement('input', {
                    type: 'checkbox',
                    checked: this.state.form.Archive,
                    onChange: function(e) { _this.setState({ form: Object.assign({}, _this.state.form, { Archive: e.target.checked }) }); },
                    className: 'mr-2',
                    'aria-label': 'Archive survey'
                  }), 'Archive'
                )
              )
            )
          ),
          React.createElement('div', { className: 'flex gap-2 justify-end p-4 border-t' },
            React.createElement('button', {
              className: 'bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 flex items-center' + (this.state.isSaving ? ' opacity-50 cursor-not-allowed' : ''),
              onClick: this.handleSave.bind(this),
              disabled: this.state.isSaving,
              'aria-label': 'Save metadata'
            },
              this.state.isSaving
                ? [
                    React.createElement('div', { className: 'animate-spin rounded-full h-5 w-5 border-t-2 border-white mr-2', key: 'spinner' }),
                    'Saving...'
                  ]
                : 'Save'
            ),
            React.createElement('button', {
              className: 'bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600',
              onClick: this.props.onClose,
              disabled: this.state.isSaving,
              'aria-label': 'Cancel metadata edit'
            }, 'Cancel')
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
        filters: { status: [], search: '' },
        isLoadingUser: true,
        isLoadingSurveys: false,
        notifications: [],
        userLoaded: false
      };
      this.addNotification = this.addNotification.bind(this);
      this.loadCurrentUser = this.loadCurrentUser.bind(this);
      this.tryRestUser = this.tryRestUser.bind(this);
      this.fetchUserDetails = this.fetchUserDetails.bind(this);
      this.loadSurveys = this.loadSurveys.bind(this);
      this.applyFilters = this.applyFilters.bind(this);
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
          _this.addNotification('Failed to load user information after multiple attempts.', 'error');
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
      var selectFields = 'Id,Title,Owners/Id,Owners/Title,Author/Id,Author/Title,StartDate,EndDate,Status,Archive';
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
      var matchesSearch = !search || survey.Title.toLowerCase().includes(search.toLowerCase());
      return matchesSearch;
    }
    render() {
      var _this = this;
      if (this.state.isLoadingUser) {
        return React.createElement('div', { className: 'flex items-center justify-center h-screen' },
          React.createElement('div', { className: 'animate-spin rounded-full h-12 w-12 border-t-4 border-blue-500' })
        );
      }
      var filteredSurveys = this.state.surveys.filter(this.applyFilters.bind(this));
      return React.createElement('div', { className: 'flex flex-col h-screen p-4' },
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
        React.createElement('div', { className: 'flex justify-between items-center mb-4' },
          React.createElement('input', {
            type: 'text',
            placeholder: 'Search surveys...',
            className: 'w-1/2 p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500',
            onChange: function(e) { _this.setState({ filters: { search: e.target.value } }); },
            'aria-label': 'Search surveys'
          }),
          React.createElement('button', {
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
      );
    }
  }

  ReactDOM.render(React.createElement(App), document.getElementById('root'));
});