// Utility to get SharePoint request digest
function getDigest() {
  return jQuery.ajax({
    url: window._spPageContextInfo.webAbsoluteUrl + '/_api/contextinfo',
    method: 'POST',
    headers: { 'Accept': 'application/json; odata=verbose' },
    xhrFields: { withCredentials: true }
  }).then(function(data) {
    return data.d.GetContextWebInformation.FormDigestValue;
  });
}

// Notification component
class Notification extends React.Component {
  render() {
    var className = 'fixed top-4 right-4 p-4 rounded shadow-lg text-white max-w-sm z-2000';
    if (this.props.type === 'error') className += ' bg-red-500';
    else if (this.props.type === 'warning') className += ' bg-yellow-500';
    else if (this.props.type === 'info') className += ' bg-blue-500';
    else className += ' bg-green-500';
    return React.createElement('div', { className: className }, this.props.message);
  }
}

// TopNav component with logo
class TopNav extends React.Component {
  render() {
    return React.createElement('nav', {
      className: 'bg-blue-600 text-white p-4 flex justify-between items-center'
    },
      React.createElement('div', { className: 'flex items-center' },
        React.createElement('img', {
          src: '/SiteAssets/logo.png', // Replace with actual logo URL
          alt: 'Survey Dashboard Logo',
          className: 'h-8 mr-2'
        }),
        React.createElement('div', { className: 'text-lg font-bold' }, 'Survey Dashboard')
      ),
      React.createElement('div', null,
        React.createElement('span', { className: 'mr-4' }, 'Welcome, ' + this.props.currentUserName)
      )
    );
  }
}

// SideNav component with darker background
class SideNav extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isOpen: false,
      searchTerm: '',
      selectedFilter: 'All'
    };
  }
  render() {
    var _this = this;
    return React.createElement('div', {
      className: 'bg-gray-800 text-white w-64 h-screen fixed md:static md:block ' + (this.state.isOpen ? 'block' : 'hidden')
    },
      React.createElement('button', {
        className: 'md:hidden bg-blue-500 text-white px-2 py-1 rounded m-2',
        onClick: function() { _this.setState({ isOpen: !_this.state.isOpen }); }
      }, this.state.isOpen ? 'Collapse' : 'Expand'),
      React.createElement('div', { className: 'p-4' },
        React.createElement('div', { className: 'mb-4' },
          React.createElement('input', {
            type: 'text',
            placeholder: 'Search surveys...',
            value: this.state.searchTerm,
            onChange: function(e) {
              _this.setState({ searchTerm: e.target.value });
              _this.props.onFilter({ searchTerm: e.target.value, status: _this.state.selectedFilter });
            },
            className: 'w-full p-2 border rounded bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500',
            'aria-label': 'Search surveys'
          })
        ),
        React.createElement('ul', { className: 'space-y-2' },
          ['All', 'Published', 'Draft', 'Upcoming', 'Running'].map(function(filter) {
            return React.createElement('li', { key: filter },
              React.createElement('button', {
                className: 'w-full text-left p-2 hover:bg-gray-700 rounded ' +
                  (_this.state.selectedFilter === filter ? 'bg-gray-700 font-semibold' : ''),
                onClick: function() {
                  _this.setState({ selectedFilter: filter });
                  _this.props.onFilter({ searchTerm: _this.state.searchTerm, status: filter });
                }
              }, filter)
            );
          })
        )
      )
    );
  }
}

// SurveyCard component with header, footer, chips for owners and responses
class SurveyCard extends React.Component {
  render() {
    const startDate = this.props.survey.StartDate ? new Date(this.props.survey.StartDate).toLocaleDateString('en-US') : 'N/A';
    const endDate = this.props.survey.EndDate ? new Date(this.props.survey.EndDate).toLocaleDateString('en-US') : 'N/A';
    return React.createElement('div', {
      className: 'bg-white rounded shadow-md hover:shadow-lg transition flex flex-col'
    },
      // Header
      React.createElement('div', {
        className: 'p-4 border-b bg-gray-50'
      },
        React.createElement('h3', {
          className: 'text-lg font-semibold truncate',
          title: this.props.survey.Title
        }, this.props.survey.Title)
      ),
      // Body
      React.createElement('div', { className: 'p-4 flex-grow' },
        React.createElement('p', { className: 'text-gray-600 mb-2' },
          'Status: ', React.createElement('span', {
            className: this.props.survey.Status === 'Published' ? 'text-green-600 font-semibold' : 'text-gray-600'
          }, this.props.survey.Status || 'Draft')
        ),
        React.createElement('p', { className: 'text-gray-600 mb-2' },
          'Date Range: ' + startDate + ' - ' + endDate
        ),
        React.createElement('div', { className: 'flex flex-wrap gap-2 mb-2' },
          React.createElement('div', {
            className: 'bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm'
          }, 'Responses: ' + (this.props.survey.responseCount || 0))
        ),
        React.createElement('div', { className: 'flex flex-wrap gap-2' },
          this.props.survey.Owners?.results?.length > 0
            ? this.props.survey.Owners.results.map(function(owner) {
                return React.createElement('div', {
                  key: owner.Id,
                  className: 'bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm'
                }, owner.Title);
              })
            : React.createElement('p', { className: 'text-gray-500 text-sm' }, 'No owners')
        )
      ),
      // Footer
      React.createElement('div', {
        className: 'p-4 border-t bg-gray-50 flex gap-2 flex-wrap'
      },
        React.createElement('button', {
          className: 'bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600',
          onClick: function() { window.location.href = '/builder?surveyId=' + this.props.survey.Id; }.bind(this),
          'aria-label': 'Edit survey form'
        }, 'Edit Form'),
        React.createElement('button', {
          className: 'bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600',
          onClick: function() { window.location.href = '/response?surveyId=' + this.props.survey.Id; }.bind(this),
          'aria-label': 'View survey report'
        }, 'View Report'),
        React.createElement('button', {
          className: 'bg-purple-500 text-white px-3 py-1 rounded hover:bg-purple-600',
          onClick: this.props.onViewQR,
          'aria-label': 'View QR code'
        }, 'QR Code'),
        React.createElement('button', {
          className: 'bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600',
          onClick: this.props.onEditMetadata,
          'aria-label': 'Edit survey metadata'
        }, 'Edit Metadata'),
        React.createElement('button', {
          className: 'bg-indigo-500 text-white px-3 py-1 rounded hover:bg-indigo-600',
          onClick: function() { window.location.href = '/formfiller?surveyId=' + this.props.survey.Id; }.bind(this),
          'aria-label': 'Fill survey form'
        }, 'Fill Form'),
        this.props.survey.AuthorId === this.props.currentUserId && React.createElement('button', {
          className: 'bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600',
          onClick: this.props.onDelete,
          'aria-label': 'Delete survey'
        }, 'Delete')
      )
    );
  }
}

// QRModal component with download and copy URL
class QRModal extends React.Component {
  componentDidMount() {
    var qr = new QRious({
      element: document.getElementById('qr-' + this.props.survey.Id),
      value: window._spPageContextInfo.webAbsoluteUrl + '/formfiller?surveyId=' + this.props.survey.Id,
      size: 200
    });
  }
  downloadQR() {
    var canvas = document.getElementById('qr-' + this.props.survey.Id);
    var link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = this.props.survey.Title.replace(/[^a-z0-9]/gi, '_') + '_QR.png';
    link.click();
  }
  copyURL() {
    var url = window._spPageContextInfo.webAbsoluteUrl + '/formfiller?surveyId=' + this.props.survey.Id;
    navigator.clipboard.writeText(url).then(() => {
      this.props.addNotification('URL copied to clipboard!', 'success');
    }).catch(() => {
      this.props.addNotification('Failed to copy URL.', 'error');
    });
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
          React.createElement('h2', { className: 'text-lg font-bold' }, 'QR Code'),
          React.createElement('button', {
            type: 'button',
            className: 'text-gray-600 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full w-8 h-8 flex items-center justify-center',
            onClick: this.props.onClose,
            'aria-label': 'Close QR modal'
          }, '\u00D7')
        ),
        React.createElement('div', { className: 'p-6 flex justify-center' },
          React.createElement('canvas', { id: 'qr-' + this.props.survey.Id })
        ),
        React.createElement('div', { className: 'p-4 border-t bg-gray-50 flex justify-end gap-3' },
          React.createElement('button', {
            type: 'button',
            className: 'bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition',
            onClick: this.copyURL.bind(this),
            'aria-label': 'Copy form URL'
          }, 'Copy URL'),
          React.createElement('button', {
            type: 'button',
            className: 'bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 transition',
            onClick: this.downloadQR.bind(this),
            'aria-label': 'Download QR code'
          }, 'Download'),
          React.createElement('button', {
            type: 'button',
            className: 'bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 transition',
            onClick: this.props.onClose,
            'aria-label': 'Close QR modal'
          }, 'Close')
        )
      )
    );
  }
}

// DeleteModal component
class DeleteModal extends React.Component {
  render() {
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
            className: 'text-lg font-bold text-gray-800'
          }, 'Confirm Deletion'),
          React.createElement('button', {
            type: 'button',
            className: 'text-gray-600 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full w-8 h-8 flex items-center justify-center',
            onClick: this.props.onCancel,
            'aria-label': 'Cancel deletion'
          }, '\u00D7')
        ),
        React.createElement('div', { className: 'p-6' },
          React.createElement('p', { className: 'text-gray-600' },
            'Are you sure you want to delete the survey "' + this.props.survey.Title + '"? This action cannot be undone.'
          )
        ),
        React.createElement('div', { className: 'p-4 border-t bg-gray-50 flex justify-end gap-3' },
          React.createElement('button', {
            type: 'button',
            className: 'bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 transition',
            onClick: this.props.onConfirm,
            'aria-label': 'Confirm deletion'
          }, 'Confirm'),
          React.createElement('button', {
            type: 'button',
            className: 'bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 transition',
            onClick: this.props.onCancel,
            'aria-label': 'Cancel deletion'
          }, 'Cancel')
        )
      )
    );
  }
}

// EditModal component with site users only
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
        Status: this.props.survey.Status || 'Draft'
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
        var siteUsersUrl = window._spPageContextInfo.webAbsoluteUrl + '/_api/web/siteusers?$select=Id,Title,Email&$filter=' +
          'substringof(\'' + encodeURIComponent(_this.state.searchTerm) + '\',Title) or ' +
          'substringof(\'' + encodeURIComponent(_this.state.searchTerm) + '\',Email)&$top=10';
        console.log('Site users query:', siteUsersUrl);
        jQuery.ajax({
          url: siteUsersUrl,
          headers: { 'Accept': 'application/json; odata=verbose' },
          xhrFields: { withCredentials: true }
        }).done(function(data) {
          if (!_this._isMounted) return;
          console.log('Site users response:', data);
          var users = data.d.results
            .filter(function(u) { return u.Id && (u.Title || u.Email) && u.PrincipalType === 1; })
            .map(function(u) { return { Id: u.Id, Title: u.Title || u.Email }; });
          console.log('Parsed site users:', users);
          var availableUsers = users.filter(function(u) {
            return !_this.state.form.Owners.some(function(selected) { return selected.Id === u.Id; });
          });
          _this.setState({
            searchResults: availableUsers,
            isLoadingUsers: false,
            showDropdown: availableUsers.length > 0
          });
          if (availableUsers.length === 0) {
            _this.props.addNotification('No matching site users found.', 'warning');
          }
        }).fail(function(xhr, status, error) {
          if (!_this._isMounted) return;
          console.error('Site users error:', error, xhr.responseText);
          _this.props.addNotification('Failed to search site users: ' + (xhr.responseText || error), 'error');
          _this.setState({ isLoadingUsers: false, showDropdown: false });
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
    if (this.state.form.StartDate && this.state.form.EndDate &&
        new Date(this.state.form.EndDate) <= new Date(this.state.form.StartDate)) {
      this.props.addNotification('End Date must be after Start Date.', 'error');
      this.setState({ isSaving: false });
      return;
    }
    if (!this.state.form.Owners.some(function(o) { return o.Id === _this.props.currentUserId; })) {
      this.props.addNotification('You must remain an owner of the survey.', 'error');
      return;
    }
    this.setState({ isSaving: true });
    getDigest().then(function(digest) {
      var payload = {
        '__metadata': { 'type': 'SP.Data.SurveysListItem' },
        OwnersId: { results: _this.state.form.Owners.map(function(o) { return o.Id; }) },
        Status: _this.state.form.Status
      };
      if (_this.state.form.StartDate) payload.StartDate = new Date(_this.state.form.StartDate).toISOString();
      if (_this.state.form.EndDate) payload.EndDate = new Date(_this.state.form.EndDate).toISOString();
      console.log('Saving metadata for survey:', _this.props.survey.Id, payload);
      jQuery.ajax({
        url: window._spPageContextInfo.webAbsoluteUrl + '/_api/web/lists/getbytitle(\'Surveys\')/items(' + _this.props.survey.Id + ')',
        type: 'POST',
        data: JSON.stringify(payload),
        headers: {
          'X-HTTP-Method': 'MERGE',
          'If-Match': '*',
          'Accept': 'application/json; odata=verbose',
          'Content-Type': 'application/json; odata=verbose',
          'X-RequestDigest': digest
        },
        xhrFields: { withCredentials: true }
      }).then(function() {
        return jQuery.ajax({
          url: window._spPageContextInfo.webAbsoluteUrl + '/_api/web/lists/getbytitle(\'Surveys\')/items(' + _this.props.survey.Id + ')/effectiveBasePermissions',
          headers: { 'Accept': 'application/json; odata=verbose' },
          xhrFields: { withCredentials: true }
        });
      }).then(function(permissions) {
        var hasManagePermissions = permissions.d.EffectiveBasePermissions.High & 0x00000080;
        if (hasManagePermissions) {
          return jQuery.ajax({
            url: window._spPageContextInfo.webAbsoluteUrl + '/_api/web/lists/getbytitle(\'Surveys\')/items(' + _this.props.survey.Id + ')/breakroleinheritance(copyRoleAssignments=false, clearSubscopes=true)',
            type: 'POST',
            headers: {
              'Accept': 'application/json; odata=verbose',
              'X-RequestDigest': digest
            },
            xhrFields: { withCredentials: true }
          }).then(function() {
            if (_this.state.form.Owners.length > 0) {
              return Promise.all(_this.state.form.Owners.map(function(user) {
                return jQuery.ajax({
                  url: window._spPageContextInfo.webAbsoluteUrl + '/_api/web/lists/getbytitle(\'Surveys\')/items(' + _this.props.survey.Id + ')/roleassignments/addroleassignment(principalid=' + user.Id + ', roledefid=1073741827)',
                  type: 'POST',
                  headers: {
                    'Accept': 'application/json; odata=verbose',
                    'X-RequestDigest': digest
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
            title: 'Edit Metadata'
          }, 'Edit Metadata'),
          React.createElement('button', {
            type: 'button',
            className: 'text-gray-600 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full w-8 h-8 flex items-center justify-center',
            onClick: this.props.onClose,
            'aria-label': 'Close metadata modal'
          }, '\u00D7')
        ),
        React.createElement('div', {
          className: 'p-6 max-h-96 overflow-y-auto'
        },
          React.createElement('div', { className: 'space-y-4' },
            React.createElement('div', null,
              React.createElement('label', { className: 'block mb-1 text-gray-700' }, 'Owners'),
              React.createElement('div', { className: 'relative' },
                React.createElement('input', {
                  type: 'text',
                  value: this.state.searchTerm,
                  onChange: function(e) { _this.setState({ searchTerm: e.target.value }); },
                  placeholder: 'Search for site users by name or email...',
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
                          type: 'button',
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
              React.createElement('label', { className: 'block mb-1 text-gray-700' }, 'Start Date'),
              React.createElement('input', {
                type: 'date',
                value: this.state.form.StartDate,
                onChange: function(e) { _this.setState({ form: Object.assign({}, _this.state.form, { StartDate: e.target.value }) }); },
                className: 'w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500',
                'aria-label': 'Start date'
              })
            ),
            React.createElement('div', null,
              React.createElement('label', { className: 'block mb-1 text-gray-700' }, 'End Date'),
              React.createElement('input', {
                type: 'date',
                value: this.state.form.EndDate,
                onChange: function(e) { _this.setState({ form: Object.assign({}, _this.state.form, { EndDate: e.target.value }) }); },
                className: 'w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500',
                'aria-label': 'End date'
              })
            ),
            React.createElement('div', null,
              React.createElement('label', { className: 'block mb-1 text-gray-700' }, 'Status'),
              React.createElement('select', {
                value: this.state.form.Status,
                onChange: function(e) { _this.setState({ form: Object.assign({}, _this.state.form, { Status: e.target.value }) }); },
                className: 'w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500',
                'aria-label': 'Survey status'
              },
                React.createElement('option', { value: 'Published' }, 'Published'),
                React.createElement('option', { value: 'Draft' }, 'Draft')
              )
            )
          )
        ),
        React.createElement('div', {
          className: 'flex flex-wrap gap-3 justify-end p-4 border-t bg-gray-50'
        },
          React.createElement('button', {
            type: 'button',
            className: 'bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 transition' + (this.state.isSaving ? ' opacity-50 cursor-not-allowed' : ''),
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
            type: 'button',
            className: 'bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 transition',
            onClick: this.props.onClose,
            disabled: this.state.isSaving,
            'aria-label': 'Cancel metadata edit'
          }, 'Cancel')
        )
      )
    );
  }
}

// Placeholder components for pages
class FormFillerComponent extends React.Component {
  render() {
    const params = new URLSearchParams(window.location.search);
    const surveyId = params.get('surveyId');
    return React.createElement('div', { className: 'p-4' },
      React.createElement('h1', { className: 'text-2xl font-bold' }, 'Form Filler'),
      React.createElement('p', null, 'Filling survey ID: ' + (surveyId || 'N/A'))
    );
  }
}

class BuilderComponent extends React.Component {
  render() {
    const params = new URLSearchParams(window.location.search);
    const surveyId = params.get('surveyId');
    return React.createElement('div', { className: 'p-4' },
      React.createElement('h1', { className: 'text-2xl font-bold' }, 'Survey Builder'),
      React.createElement('p', null, 'Editing survey ID: ' + (surveyId || 'N/A'))
    );
  }
}

class ResponseComponent extends React.Component {
  render() {
    const params = new URLSearchParams(window.location.search);
    const surveyId = params.get('surveyId');
    return React.createElement('div', { className: 'p-4' },
      React.createElement('h1', { className: 'text-2xl font-bold' }, 'Survey Responses'),
      React.createElement('p', null, 'Viewing responses for survey ID: ' + (surveyId || 'N/A'))
    );
  }
}

// Main App component
class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      surveys: [],
      filteredSurveys: [],
      currentUserId: null,
      currentUserName: null,
      notifications: [],
      editingSurvey: null,
      viewingQR: null,
      deletingSurvey: null,
      currentPage: window.location.pathname
    };
    this.loadSurveys = this.loadSurveys.bind(this);
    this.addNotification = this.addNotification.bind(this);
    this.handleDelete = this.handleDelete.bind(this);
    this.handleFilter = this.handleFilter.bind(this);
  }
  componentDidMount() {
    var _this = this;
    jQuery.ajax({
      url: window._spPageContextInfo.webAbsoluteUrl + '/_api/web/currentuser',
      headers: { 'Accept': 'application/json; odata=verbose' },
      xhrFields: { withCredentials: true }
    }).done(function(data) {
      _this.setState({
        currentUserId: data.d.Id,
        currentUserName: data.d.Title
      });
    }).fail(function(xhr, status, error) {
      console.error('Error loading current user:', error);
      _this.addNotification('Failed to load user information: ' + (xhr.responseText || error), 'error');
    });
    this.loadSurveys();
    window.addEventListener('popstate', function() {
      _this.setState({ currentPage: window.location.pathname });
    });
  }
  loadSurveys() {
    var _this = this;
    jQuery.ajax({
      url: window._spPageContextInfo.webAbsoluteUrl + '/_api/web/lists/getbytitle(\'Surveys\')/items?$select=Id,Title,Owners/Id,Owners/Title,StartDate,EndDate,Status,AuthorId&$expand=Owners',
      headers: { 'Accept': 'application/json; odata=verbose' },
      xhrFields: { withCredentials: true }
    }).done(function(data) {
      var surveys = data.d.results;
      Promise.all(surveys.map(function(survey) {
        return jQuery.ajax({
          url: window._spPageContextInfo.webAbsoluteUrl + '/_api/web/lists/getbytitle(\'Survey Responses\')/items?$filter=SurveyId eq ' + survey.Id + '&$count=true',
          headers: { 'Accept': 'application/json; odata=verbose' },
          xhrFields: { withCredentials: true }
        }).then(function(responseData) {
          survey.responseCount = responseData.d.__count || 0;
          return survey;
        }).catch(function(error) {
          console.error('Error fetching responses for survey ' + survey.Id + ':', error);
          survey.responseCount = 0;
          return survey;
        });
      })).then(function(updatedSurveys) {
        _this.setState({ surveys: updatedSurveys, filteredSurveys: updatedSurveys });
      }).catch(function(error) {
        console.error('Error processing response counts:', error);
        _this.addNotification('Failed to load response counts.', 'error');
      });
    }).fail(function(xhr, status, error) {
      console.error('Error loading surveys:', error);
      _this.addNotification('Failed to load surveys: ' + (xhr.responseText || error), 'error');
    });
  }
  addNotification(message, type) {
    var _this = this;
    var id = Date.now();
    this.setState({
      notifications: this.state.notifications.concat([{ id: id, message: message, type: type || 'success' }])
    });
    setTimeout(function() {
      _this.setState({
        notifications: _this.state.notifications.filter(function(n) { return n.id !== id; })
      });
    }, 5000);
  }
  handleDelete(surveyId) {
    var _this = this;
    this.setState({ deletingSurvey: null });
    getDigest().then(function(digest) {
      jQuery.ajax({
        url: window._spPageContextInfo.webAbsoluteUrl + '/_api/web/lists/getbytitle(\'Surveys\')/items(' + surveyId + ')',
        type: 'POST',
        headers: {
          'X-HTTP-Method': 'DELETE',
          'If-Match': '*',
          'Accept': 'application/json; odata=verbose',
          'X-RequestDigest': digest
        },
        xhrFields: { withCredentials: true }
      }).done(function() {
        _this.addNotification('Survey deleted successfully!');
        console.log('Survey deleted:', surveyId);
        _this.loadSurveys();
      }).fail(function(xhr, status, error) {
        console.error('Error deleting survey:', error);
        var errorMessage = xhr.responseText || error || 'Unknown error';
        if (xhr.status === 403) errorMessage = 'Access denied. You do not have permission to delete this survey.';
        _this.addNotification('Failed to delete survey: ' + errorMessage, 'error');
      });
    }).fail(function(error) {
      console.error('Error getting digest:', error);
      _this.addNotification('Failed to delete survey: Unable to get request digest.', 'error');
    });
  }
  handleFilter({ searchTerm, status }) {
    var filtered = this.state.surveys;
    if (searchTerm) {
      searchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(function(survey) {
        return survey.Title.toLowerCase().includes(searchTerm);
      });
    }
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    if (status !== 'All') {
      filtered = filtered.filter(function(survey) {
        var startDate = survey.StartDate ? new Date(survey.StartDate) : null;
        var endDate = survey.EndDate ? new Date(survey.EndDate) : null;
        if (status === 'Published') return survey.Status === 'Published';
        if (status === 'Draft') return survey.Status === 'Draft';
        if (status === 'Upcoming') return startDate && startDate > today;
        if (status === 'Running') {
          return startDate && endDate &&
                 startDate <= today && endDate >= today &&
                 survey.Status === 'Published';
        }
        return true;
      });
    }
    this.setState({ filteredSurveys: filtered });
  }
  render() {
    var _this = this;
    var content;
    if (this.state.currentPage.includes('/formfiller')) {
      content = React.createElement(FormFillerComponent);
    } else if (this.state.currentPage.includes('/builder')) {
      content = React.createElement(BuilderComponent);
    } else if (this.state.currentPage.includes('/response')) {
      content = React.createElement(ResponseComponent);
    } else {
      content = React.createElement('div', { className: 'p-4' },
        React.createElement('div', { className: 'flex justify-between items-center mb-4' },
          React.createElement('h1', { className: 'text-2xl font-bold' }, 'Surveys'),
          React.createElement('button', {
            className: 'bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition',
            onClick: function() { window.location.href = '/builder?surveyId=new'; },
            'aria-label': 'Create new survey'
          }, 'Create New Form')
        ),
        React.createElement('div', { className: 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4' },
          this.state.filteredSurveys.map(function(survey) {
            return React.createElement(SurveyCard, {
              key: survey.Id,
              survey: survey,
              currentUserId: _this.state.currentUserId,
              onEditMetadata: function() { _this.setState({ editingSurvey: survey }); },
              onViewQR: function() { _this.setState({ viewingQR: survey }); },
              onDelete: function() { _this.setState({ deletingSurvey: survey }); },
              addNotification: _this.addNotification.bind(_this)
            });
          })
        )
      );
    }
    return React.createElement('div', { className: 'min-h-screen bg-gray-100' },
      React.createElement(TopNav, { currentUserName: this.state.currentUserName }),
      React.createElement('div', { className: 'flex' },
        React.createElement(SideNav, { onFilter: this.handleFilter.bind(this) }),
        React.createElement('main', { className: 'flex-1 p-4' }, content)
      ),
      this.state.notifications.map(function(notification) {
        return React.createElement(Notification, {
          key: notification.id,
          message: notification.message,
          type: notification.type
        });
      }),
      this.state.editingSurvey && React.createElement(EditModal, {
        survey: this.state.editingSurvey,
        currentUserId: this.state.currentUserId,
        addNotification: this.addNotification.bind(this),
        loadSurveys: this.loadSurveys.bind(this),
        onClose: function() { _this.setState({ editingSurvey: null }); }
      }),
      this.state.viewingQR && React.createElement(QRModal, {
        survey: this.state.viewingQR,
        addNotification: this.addNotification.bind(this),
        onClose: function() { _this.setState({ viewingQR: null }); }
      }),
      this.state.deletingSurvey && React.createElement(DeleteModal, {
        survey: this.state.deletingSurvey,
        onConfirm: function() { _this.handleDelete(_this.state.deletingSurvey.Id); },
        onCancel: function() { _this.setState({ deletingSurvey: null }); }
      })
    );
  }
}

// Render the app
ReactDOM.render(React.createElement(App), document.getElementById('root'));