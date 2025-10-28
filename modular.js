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

// Load Font Awesome for icons
const faLink = document.createElement('link');
faLink.rel = 'stylesheet';
faLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
document.head.appendChild(faLink);

// CSS override for SharePoint elements
const sharePointStyles = `
  #s4-ribbonrow, #s4-titlerow { display: none !important; }
  #s4-workspace { overflow: visible !important; position: static !important; }
  #contentBox { margin-top: 0 !important; padding-top: 0 !important; }
`;
const styleSheet = document.createElement('style');
styleSheet.textContent = sharePointStyles;
document.head.appendChild(styleSheet);

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

// TopNav component with mobile toggle
class TopNav extends React.Component {
  componentDidMount() {
    console.log('TopNav height:', document.querySelector('.bg-blue-600')?.offsetHeight || 'Not rendered');
    console.log('Ribbon height:', document.querySelector('#s4-ribbonrow')?.offsetHeight || 'No ribbon');
  }
  render() {
    return React.createElement('nav', {
      className: 'bg-blue-600 text-white p-4 flex justify-between items-center fixed top-0 left-0 right-0 z-1000 h-16'
    },
      // Mobile hamburger toggle
      React.createElement('button', {
        className: 'md:hidden text-white p-2 rounded focus:outline-none focus:ring-2 focus:ring-white',
        onClick: this.props.onToggleSidebar,
        'aria-label': this.props.isSidebarOpen ? 'Close sidebar' : 'Open sidebar'
      },
        React.createElement('i', {
          className: this.props.isSidebarOpen ? 'fas fa-times text-xl' : 'fas fa-bars text-xl'
        })
      ),
      React.createElement('div', { className: 'flex items-center flex-1 justify-center md:justify-start' },
        React.createElement('img', {
          src: '/SiteAssets/logo.png',
          alt: 'Forms Logo',
          className: 'h-8 mr-2'
        }),
        React.createElement('div', { className: 'text-lg font-bold hidden md:block' }, 'Forms')  // Hide title on very small mobile for space
      ),
      React.createElement('div', null,
        React.createElement('span', { className: 'mr-4 hidden md:inline' }, 'Welcome, ' + this.props.currentUserName)
      )
    );
  }
}

// SideNav component - transform for mobile overlay
class SideNav extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      searchTerm: '',
      selectedFilter: 'All'
    };
  }
  render() {
    var _this = this;
    const sidebarClass = `bg-gray-800 text-white w-64 h-screen fixed top-0 left-0 md:static md:translate-x-0 z-900 transform transition-transform duration-300 ease-in-out ${
      this.props.isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
    } ${!this.props.isOpen ? 'md:w-auto' : ''}`;  // Overlay on mobile, static on desktop

    return React.createElement('div', { className: sidebarClass },
      // No toggle here - moved to TopNav
      React.createElement('div', { className: 'p-4 overflow-y-auto h-full' },
        React.createElement('div', { className: 'mb-4' },
          React.createElement('input', {
            type: 'text',
            placeholder: 'Search forms...',
            value: this.state.searchTerm,
            onChange: function(e) {
              _this.setState({ searchTerm: e.target.value });
              _this.props.onFilter({ searchTerm: e.target.value, status: _this.state.selectedFilter });
            },
            className: 'w-full p-2 border rounded bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500',
            'aria-label': 'Search forms'
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

// SurveyCard component
class SurveyCard extends React.Component {
  render() {
    const startDate = this.props.survey.StartDate ? new Date(this.props.survey.StartDate).toLocaleDateString('en-US') : 'N/A';
    const endDate = this.props.survey.EndDate ? new Date(this.props.survey.EndDate).toLocaleDateString('en-US') : 'N/A';
    return React.createElement('div', {
      className: 'bg-white rounded shadow-md hover:shadow-lg transition flex flex-col'
    },
      React.createElement('div', { className: 'p-4 border-b bg-gray-50' },
        React.createElement('h3', {
          className: 'text-lg font-semibold truncate',
          title: this.props.survey.Title
        }, this.props.survey.Title)
      ),
      React.createElement('div', { className: 'p-4 flex-grow' },
        React.createElement('p', { className: 'text-gray-600 mb-2' },
          'Status: ', React.createElement('span', {
            className: this.props.survey.Status === 'Published' ? 'text-green-600 font-semibold' : 'text-gray-600'
          }, this.props.survey.Status || 'Draft')
        ),
        React.createElement('p', { className: 'text-gray-600 mb-2' },
          'Date Range: ' + startDate + ' - ' + endDate
        ),
        React.createElement('div', { className: 'mb-2' },
          React.createElement('span', { className: 'text-gray-600' }, 'No of Responses: '),
          React.createElement('div', {
            className: 'inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm ml-2'
          }, 'Responses: ' + (this.props.survey.responseCount || 0))
        ),
        React.createElement('div', { className: 'mb-2' },
          React.createElement('span', { className: 'text-gray-600' }, 'Owners: '),
          this.props.survey.Owners?.results?.length > 0
            ? React.createElement('div', { className: 'inline-flex flex-wrap gap-2 ml-2' },
                this.props.survey.Owners.results.map(function(owner) {
                  return React.createElement('div', {
                    key: owner.Id,
                    className: 'bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm'
                  }, owner.Title);
                })
              )
            : React.createElement('span', { className: 'text-gray-500 text-sm ml-2' }, 'No owners')
        )
      ),
      React.createElement('div', { className: 'p-4 border-t bg-gray-50 flex gap-2 flex-wrap' },
        React.createElement('button', {
          className: 'bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 flex items-center text-xs md:text-sm',
          onClick: function() { window.open('/builder.aspx?surveyId=' + this.props.survey.Id, '_blank'); }.bind(this),
          'aria-label': 'Edit form'
        },
          React.createElement('i', { className: 'fas fa-edit mr-2' }),
          'Edit Form'
        ),
        React.createElement('button', {
          className: 'bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 flex items-center text-xs md:text-sm',
          onClick: function() { window.open('/response.aspx?surveyId=' + this.props.survey.Id, '_blank'); }.bind(this),
          'aria-label': 'View form report'
        },
          React.createElement('i', { className: 'fas fa-chart-bar mr-2' }),
          'View Report'
        ),
        React.createElement('button', {
          className: 'bg-purple-500 text-white px-3 py-1 rounded hover:bg-purple-600 flex items-center text-xs md:text-sm',
          onClick: this.props.onViewQR,
          'aria-label': 'View QR code'
        },
          React.createElement('i', { className: 'fas fa-qrcode mr-2' }),
          'QR Code'
        ),
        React.createElement('button', {
          className: 'bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600 flex items-center text-xs md:text-sm',
          onClick: this.props.onEditMetadata,
          'aria-label': 'Edit form metadata'
        },
          React.createElement('i', { className: 'fas fa-cog mr-2' }),
          'Edit Metadata'
        ),
        React.createElement('button', {
          className: 'bg-indigo-500 text-white px-3 py-1 rounded hover:bg-indigo-600 flex items-center text-xs md:text-sm',
          onClick: function() { window.open('/formfiller.aspx?surveyId=' + this.props.survey.Id, '_blank'); }.bind(this),
          'aria-label': 'Fill form'
        },
          React.createElement('i', { className: 'fas fa-pen mr-2' }),
          'Fill Form'
        ),
        this.props.survey.AuthorId === this.props.currentUserId && React.createElement('button', {
          className: 'bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 flex items-center text-xs md:text-sm',
          onClick: this.props.onDelete,
          'aria-label': 'Delete form'
        },
          React.createElement('i', { className: 'fas fa-trash mr-2' }),
          'Delete'
        )
      )
    );
  }
}

// QRModal component
class QRModal extends React.Component {
  componentDidMount() {
    var qr = new QRious({
      element: document.getElementById('qr-' + this.props.survey.Id),
      value: window._spPageContextInfo.webAbsoluteUrl + '/formfiller.aspx?surveyId=' + this.props.survey.Id,
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
    var url = window._spPageContextInfo.webAbsoluteUrl + '/formfiller.aspx?surveyId=' + this.props.survey.Id;
    navigator.clipboard.writeText(url).then(() => {
      this.props.addNotification('URL copied to clipboard!', 'success');
    }).catch(() => {
      this.props.addNotification('Failed to copy URL.', 'error');
    });
  }
  render() {
    var _this = this;
    return React.createElement('div', {
      className: 'fixed inset-0 flex items-center justify-center z-1200 bg-black/50'
    },
      React.createElement('div', { className: 'bg-white rounded-lg shadow-xl w-11/12 max-w-md sm:max-w-lg md:max-w-xl' },
        React.createElement('div', { className: 'flex justify-between items-center p-4 border-b bg-gray-100' },
          React.createElement('h2', { className: 'text-lg font-bold' }, 'QR Code'),
          React.createElement('button', {
            type: 'button',
            className: 'text-gray-600 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full w-8 h-8 flex items-center justify-center',
            onClick: this.props.onClose,
            'aria-label': 'Close QR modal'
          },
            React.createElement('i', { className: 'fas fa-times' })
          )
        ),
        React.createElement('div', { className: 'p-6 flex justify-center' },
          React.createElement('canvas', { id: 'qr-' + this.props.survey.Id })
        ),
        React.createElement('div', { className: 'p-4 border-t bg-gray-50 flex justify-end gap-3' },
          React.createElement('button', {
            type: 'button',
            className: 'bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 flex items-center',
            onClick: this.copyURL.bind(this),
            'aria-label': 'Copy form URL'
          },
            React.createElement('i', { className: 'fas fa-copy mr-2' }),
            'Copy URL'
          ),
          React.createElement('button', {
            type: 'button',
            className: 'bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 flex items-center',
            onClick: this.downloadQR.bind(this),
            'aria-label': 'Download QR code'
          },
            React.createElement('i', { className: 'fas fa-download mr-2' }),
            'Download'
          ),
          React.createElement('button', {
            type: 'button',
            className: 'bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 flex items-center',
            onClick: this.props.onClose,
            'aria-label': 'Close QR modal'
          },
            React.createElement('i', { className: 'fas fa-times mr-2' }),
            'Close'
          )
        )
      )
    );
  }
}

// DeleteModal component
class DeleteModal extends React.Component {
  render() {
    return React.createElement('div', {
      className: 'fixed inset-0 flex items-center justify-center z-1200 bg-black/50'
    },
      React.createElement('div', { className: 'bg-white rounded-lg shadow-xl w-11/12 max-w-md sm:max-w-lg md:max-w-xl' },
        React.createElement('div', { className: 'flex justify-between items-center p-4 border-b bg-gray-100' },
          React.createElement('h2', { className: 'text-lg font-bold text-gray-800' }, 'Confirm Deletion'),
          React.createElement('button', {
            type: 'button',
            className: 'text-gray-600 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full w-8 h-8 flex items-center justify-center',
            onClick: this.props.onCancel,
            'aria-label': 'Cancel deletion'
          },
            React.createElement('i', { className: 'fas fa-times' })
          )
        ),
        React.createElement('div', { className: 'p-6' },
          React.createElement('p', { className: 'text-gray-600' },
            'Are you sure you want to delete the form "' + this.props.survey.Title + '"? This action cannot be undone.'
          )
        ),
        React.createElement('div', { className: 'p-4 border-t bg-gray-50 flex justify-end gap-3' },
          React.createElement('button', {
            type: 'button',
            className: 'bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 flex items-center',
            onClick: this.props.onConfirm,
            'aria-label': 'Confirm deletion'
          },
            React.createElement('i', { className: 'fas fa-check mr-2' }),
            'Confirm'
          ),
          React.createElement('button', {
            type: 'button',
            className: 'bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 flex items-center',
            onClick: this.props.onCancel,
            'aria-label': 'Cancel deletion'
          },
            React.createElement('i', { className: 'fas fa-times mr-2' }),
            'Cancel'
          )
        )
      )
    );
  }
}

// EditModal component with permissions management
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
        jQuery.ajax({
          url: window._spPageContextInfo.webAbsoluteUrl + '/_api/web/sitegroups?$filter=Title eq \'' + encodeURIComponent(_spPageContextInfo.webTitle + ' Members') + '\'',
          headers: { 'Accept': 'application/json; odata=verbose' },
          xhrFields: { withCredentials: true }
        }).then(function(groupData) {
          if (!_this._isMounted || !groupData.d.results.length) {
            _this.setState({ isLoadingUsers: false, showDropdown: false });
            _this.props.addNotification('Members group not found.', 'error');
            return;
          }
          var groupId = groupData.d.results[0].Id;
          return jQuery.ajax({
            url: window._spPageContextInfo.webAbsoluteUrl + '/_api/web/sitegroups(' + groupId + ')/users',
            headers: { 'Accept': 'application/json; odata=verbose' },
            xhrFields: { withCredentials: true }
          });
        }).then(function(userData) {
          if (!_this._isMounted) return;
          console.log('Site members search response:', userData);
          var users = userData.d.results
            .filter(function(u) { return u.Id && u.Title && u.Title.toLowerCase().includes(_this.state.searchTerm.toLowerCase()); })
            .map(function(u) { return { Id: u.Id, Title: u.Title }; });
          console.log('Parsed users:', users);
          var availableUsers = users.filter(function(u) {
            return !_this.state.form.Owners.some(function(selected) { return selected.Id === u.Id; });
          });
          _this.setState({
            searchResults: availableUsers,
            isLoadingUsers: false,
            showDropdown: availableUsers.length > 0
          });
          if (availableUsers.length === 0) {
            _this.props.addNotification('No matching users found in site members.', 'warning');
          }
        }).fail(function(xhr, status, error) {
          if (!_this._isMounted) return;
          console.error('Site members search error:', error, xhr.responseText);
          _this.props.addNotification('Failed to search site members: ' + (xhr.responseText || error), 'error');
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
        Owners: this.state.form.Owners.filter(function(o) {
          return o.Id !== userId;
        })
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
      this.props.addNotification('You must remain an owner of the form.', 'error');
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
      console.log('Saving metadata for form:', _this.props.survey.Id, payload);
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
        if (!hasManagePermissions) {
          _this.props.addNotification('Form metadata updated. Permissions not modified due to insufficient access.', 'warning');
          _this.props.loadSurveys();
          _this.props.onClose();
          _this.setState({ isSaving: false });
          return;
        }
        // Break role inheritance
        return jQuery.ajax({
          url: window._spPageContextInfo.webAbsoluteUrl + '/_api/web/lists/getbytitle(\'Surveys\')/items(' + _this.props.survey.Id + ')/breakroleinheritance(copyRoleAssignments=false, clearSubscopes=true)',
          type: 'POST',
          headers: {
            'Accept': 'application/json; odata=verbose',
            'X-RequestDigest': digest
          },
          xhrFields: { withCredentials: true }
        }).then(function() {
          // Identify added and removed owners
          var originalOwners = Array.isArray(_this.props.survey.Owners?.results)
            ? _this.props.survey.Owners.results.map(function(o) { return o.Id; })
            : [];
          var newOwners = _this.state.form.Owners.map(function(o) { return o.Id; });
          var addedOwners = newOwners.filter(function(id) { return !originalOwners.includes(id); });
          var removedOwners = originalOwners.filter(function(id) { return !newOwners.includes(id) && id !== _this.props.currentUserId; });
          console.log('Added owners:', addedOwners);
          console.log('Removed owners:', removedOwners);
          // Add permissions for new owners
          var addPromises = addedOwners.map(function(userId) {
            console.log('Adding permission for user:', userId);
            return jQuery.ajax({
              url: window._spPageContextInfo.webAbsoluteUrl + '/_api/web/lists/getbytitle(\'Surveys\')/items(' + _this.props.survey.Id + ')/roleassignments/addroleassignment(principalid=' + userId + ', roledefid=1073741827)',
              type: 'POST',
              headers: {
                'Accept': 'application/json; odata=verbose',
                'X-RequestDigest': digest
              },
              xhrFields: { withCredentials: true }
            });
          });
          // Remove permissions for removed owners
          var removePromises = removedOwners.map(function(userId) {
            console.log('Removing permission for user:', userId);
            return jQuery.ajax({
              url: window._spPageContextInfo.webAbsoluteUrl + '/_api/web/lists/getbytitle(\'Surveys\')/items(' + _this.props.survey.Id + ')/roleassignments/removeroleassignment(principalid=' + userId + ')',
              type: 'POST',
              headers: {
                'Accept': 'application/json; odata=verbose',
                'X-RequestDigest': digest
              },
              xhrFields: { withCredentials: true }
            });
          });
          // Ensure current user retains Contribute permissions
          if (!newOwners.includes(_this.props.currentUserId)) {
            addPromises.push(jQuery.ajax({
              url: window._spPageContextInfo.webAbsoluteUrl + '/_api/web/lists/getbytitle(\'Surveys\')/items(' + _this.props.survey.Id + ')/roleassignments/addroleassignment(principalid=' + _this.props.currentUserId + ', roledefid=1073741827)',
              type: 'POST',
              headers: {
                'Accept': 'application/json; odata=verbose',
                'X-RequestDigest': digest
              },
              xhrFields: { withCredentials: true }
            }));
          }
          return Promise.all(addPromises.concat(removePromises));
        });
      }).then(function() {
        _this.props.addNotification('Form metadata and permissions updated successfully!');
        console.log('Metadata and permissions save successful for form:', _this.props.survey.Id);
        _this.props.loadSurveys();
        _this.props.onClose();
        _this.setState({ isSaving: false });
      }).fail(function(error) {
        console.error('Error updating form:', error);
        var errorMessage = error.responseText || error.message || 'Unknown error';
        if (error.status === 403) errorMessage = 'Access denied. Ensure you have Manage Permissions on this form.';
        else if (errorMessage.includes('Invalid Form Digest')) errorMessage = 'Invalid or expired request digest token. Please try again.';
        _this.props.addNotification('Failed to update form: ' + errorMessage, 'error');
        _this.setState({ isSaving: false });
      });
    }).fail(function(error) {
      console.error('Error getting digest:', error);
      _this.props.addNotification('Failed to update form: Unable to get request digest.', 'error');
      _this.setState({ isSaving: false });
    });
  }
  render() {
    var _this = this;
    return React.createElement('div', {
      className: 'fixed inset-0 flex items-center justify-center z-1200 bg-black/50'
    },
      React.createElement('div', { className: 'bg-white rounded-lg shadow-xl w-11/12 max-w-md sm:max-w-lg md:max-w-xl' },
        React.createElement('div', { className: 'flex justify-between items-center p-4 border-b bg-gray-100' },
          React.createElement('h2', { className: 'text-lg font-bold text-gray-800 truncate', title: 'Edit Metadata' }, 'Edit Metadata'),
          React.createElement('button', {
            type: 'button',
            className: 'text-gray-600 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full w-8 h-8 flex items-center justify-center',
            onClick: this.props.onClose,
            'aria-label': 'Close metadata modal'
          },
            React.createElement('i', { className: 'fas fa-times' })
          )
        ),
        React.createElement('div', { className: 'p-6 max-h-96 overflow-y-auto' },
          React.createElement('div', { className: 'space-y-4' },
            React.createElement('div', null,
              React.createElement('label', { className: 'block mb-1 text-gray-700' }, 'Owners'),
              React.createElement('div', { className: 'relative' },
                React.createElement('input', {
                  type: 'text',
                  value: this.state.searchTerm,
                  onChange: function(e) { _this.setState({ searchTerm: e.target.value }); },
                  placeholder: 'Search for site members...',
                  className: 'w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500',
                  'aria-label': 'Search for site members'
                }),
                this.state.isLoadingUsers && React.createElement('div', { className: 'absolute top-2 right-2' },
                  React.createElement('i', { className: 'fas fa-spinner fa-spin' })
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
                        }, user.Id === _this.props.currentUserId ? '' : React.createElement('i', { className: 'fas fa-times' }))
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
                'aria-label': 'Form status'
              },
                React.createElement('option', { value: 'Published' }, 'Published'),
                React.createElement('option', { value: 'Draft' }, 'Draft')
              )
            )
          )
        ),
        React.createElement('div', { className: 'flex flex-wrap gap-3 justify-end p-4 border-t bg-gray-50' },
          React.createElement('button', {
            type: 'button',
            className: 'bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 flex items-center' + (this.state.isSaving ? ' opacity-50 cursor-not-allowed' : ''),
            onClick: this.handleSave.bind(this),
            disabled: this.state.isSaving,
            'aria-label': 'Save metadata'
          },
            this.state.isSaving
              ? [React.createElement('i', { className: 'fas fa-spinner fa-spin mr-2', key: 'spinner' }), 'Saving...']
              : [React.createElement('i', { className: 'fas fa-save mr-2', key: 'save-icon' }), 'Save']
          ),
          React.createElement('button', {
            type: 'button',
            className: 'bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 flex items-center',
            onClick: this.props.onClose,
            disabled: this.state.isSaving,
            'aria-label': 'Cancel metadata edit'
          },
            React.createElement('i', { className: 'fas fa-times mr-2' }),
            'Cancel'
          )
        )
      )
    );
  }
}

// CreateFormModal component
class CreateFormModal extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      form: {
        Title: '',
        Owners: [{ Id: this.props.currentUserId, Title: this.props.currentUserName }],
        StartDate: '',
        EndDate: ''
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
          url: window._spPageContextInfo.webAbsoluteUrl + '/_api/web/sitegroups?$filter=Title eq \'' + encodeURIComponent(_spPageContextInfo.webTitle + ' Members') + '\'',
          headers: { 'Accept': 'application/json; odata=verbose' },
          xhrFields: { withCredentials: true }
        }).then(function(groupData) {
          if (!_this._isMounted || !groupData.d.results.length) {
            _this.setState({ isLoadingUsers: false, showDropdown: false });
            _this.props.addNotification('Members group not found.', 'error');
            return;
          }
          var groupId = groupData.d.results[0].Id;
          return jQuery.ajax({
            url: window._spPageContextInfo.webAbsoluteUrl + '/_api/web/sitegroups(' + groupId + ')/users',
            headers: { 'Accept': 'application/json; odata=verbose' },
            xhrFields: { withCredentials: true }
          });
        }).then(function(userData) {
          if (!_this._isMounted) return;
          console.log('Site members search response:', userData);
          var users = userData.d.results
            .filter(function(u) { return u.Id && u.Title && u.Title.toLowerCase().includes(_this.state.searchTerm.toLowerCase()); })
            .map(function(u) { return { Id: u.Id, Title: u.Title }; });
          console.log('Parsed users:', users);
          var availableUsers = users.filter(function(u) {
            return !_this.state.form.Owners.some(function(selected) { return selected.Id === u.Id; });
          });
          _this.setState({
            searchResults: availableUsers,
            isLoadingUsers: false,
            showDropdown: availableUsers.length > 0
          });
          if (availableUsers.length === 0) {
            _this.props.addNotification('No matching users found in site members.', 'warning');
          }
        }).fail(function(xhr, status, error) {
          if (!_this._isMounted) return;
          console.error('Site members search error:', error, xhr.responseText);
          _this.props.addNotification('Failed to search site members: ' + (xhr.responseText || error), 'error');
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
        Owners: this.state.form.Owners.filter(function(o) {
          return o.Id !== userId;
        })
      })
    );
  }
  handleSave() {
    var _this = this;
    if (!this.state.form.Title.trim()) {
      this.props.addNotification('Title is required.', 'error');
      return;
    }
    if (this.state.form.StartDate && this.state.form.EndDate &&
        new Date(this.state.form.EndDate) <= new Date(this.state.form.StartDate)) {
      this.props.addNotification('End Date must be after Start Date.', 'error');
      return;
    }
    if (!this.state.form.Owners.some(function(o) { return o.Id === _this.props.currentUserId; })) {
      this.props.addNotification('You must be an owner of the form.', 'error');
      return;
    }
    this.setState({ isSaving: true });
    getDigest().then(function(digest) {
      var payload = {
        '__metadata': { 'type': 'SP.Data.SurveysListItem' },
        Title: _this.state.form.Title,
        OwnersId: { results: _this.state.form.Owners.map(function(o) { return o.Id; }) },
        Status: 'Draft',
        SurveyJson: JSON.stringify({ title: _this.state.form.Title })
      };
      if (_this.state.form.StartDate) payload.StartDate = new Date(_this.state.form.StartDate).toISOString();
      if (_this.state.form.EndDate) payload.EndDate = new Date(_this.state.form.EndDate).toISOString();
      console.log('Creating new form:', payload);
      jQuery.ajax({
        url: window._spPageContextInfo.webAbsoluteUrl + '/_api/web/lists/getbytitle(\'Surveys\')/items',
        type: 'POST',
        data: JSON.stringify(payload),
        headers: {
          'Accept': 'application/json; odata=verbose',
          'Content-Type': 'application/json; odata=verbose',
          'X-RequestDigest': digest
        },
        xhrFields: { withCredentials: true }
      }).then(function(data) {
        var newItemId = data.d.Id;
        return jQuery.ajax({
          url: window._spPageContextInfo.webAbsoluteUrl + '/_api/web/lists/getbytitle(\'Surveys\')/items(' + newItemId + ')/effectiveBasePermissions',
          headers: { 'Accept': 'application/json; odata=verbose' },
          xhrFields: { withCredentials: true }
        }).then(function(permissions) {
          var hasManagePermissions = permissions.d.EffectiveBasePermissions.High & 0x00000080;
          if (!hasManagePermissions) {
            _this.props.addNotification('Form created. Permissions not set due to insufficient access.', 'warning');
            window.location.href = '/builder.aspx?surveyId=' + newItemId;
            _this.props.loadSurveys();
            _this.props.onClose();
            _this.setState({ isSaving: false });
            return Promise.resolve();
          }
          // Break role inheritance
          return jQuery.ajax({
            url: window._spPageContextInfo.webAbsoluteUrl + '/_api/web/lists/getbytitle(\'Surveys\')/items(' + newItemId + ')/breakroleinheritance(copyRoleAssignments=false, clearSubscopes=true)',
            type: 'POST',
            headers: {
              'Accept': 'application/json; odata=verbose',
              'X-RequestDigest': digest
            },
            xhrFields: { withCredentials: true }
          }).then(function() {
            // Add permissions for owners
            var ownerIds = _this.state.form.Owners.map(function(o) { return o.Id; });
            var addPromises = ownerIds.map(function(userId) {
              console.log('Adding permission for user:', userId);
              return jQuery.ajax({
                url: window._spPageContextInfo.webAbsoluteUrl + '/_api/web/lists/getbytitle(\'Surveys\')/items(' + newItemId + ')/roleassignments/addroleassignment(principalid=' + userId + ', roledefid=1073741827)',
                type: 'POST',
                headers: {
                  'Accept': 'application/json; odata=verbose',
                  'X-RequestDigest': digest
                },
                xhrFields: { withCredentials: true }
              });
            });
            return Promise.all(addPromises);
          });
        });
      }).then(function() {
        _this.props.addNotification('Form created successfully!');
        console.log('Form created, redirecting to builder:', newItemId);
        window.location.href = '/builder.aspx?surveyId=' + newItemId;
        _this.props.loadSurveys();
        _this.props.onClose();
        _this.setState({ isSaving: false });
      }).fail(function(error) {
        console.error('Error creating form:', error);
        var errorMessage = error.responseText || error.message || 'Unknown error';
        if (error.status === 403) errorMessage = 'Access denied. Ensure you have permission to create forms.';
        _this.props.addNotification('Failed to create form: ' + errorMessage, 'error');
        _this.setState({ isSaving: false });
      });
    }).fail(function(error) {
      console.error('Error getting digest:', error);
      _this.props.addNotification('Failed to create form: Unable to get request digest.', 'error');
      _this.setState({ isSaving: false });
    });
  }
  render() {
    var _this = this;
    return React.createElement('div', {
      className: 'fixed inset-0 flex items-center justify-center z-1200 bg-black/50'
    },
      React.createElement('div', { className: 'bg-white rounded-lg shadow-xl w-11/12 max-w-md sm:max-w-lg md:max-w-xl' },
        React.createElement('div', { className: 'flex justify-between items-center p-4 border-b bg-gray-100' },
          React.createElement('h2', { className: 'text-lg font-bold text-gray-800' }, 'Create New Form'),
          React.createElement('button', {
            type: 'button',
            className: 'text-gray-600 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full w-8 h-8 flex items-center justify-center',
            onClick: this.props.onClose,
            'aria-label': 'Close create form modal'
          },
            React.createElement('i', { className: 'fas fa-times' })
          )
        ),
        React.createElement('div', { className: 'p-6 max-h-96 overflow-y-auto' },
          React.createElement('div', { className: 'space-y-4' },
            React.createElement('div', null,
              React.createElement('label', { className: 'block mb-1 text-gray-700' }, 'Title *'),
              React.createElement('input', {
                type: 'text',
                value: this.state.form.Title,
                onChange: function(e) { _this.setState({ form: Object.assign({}, _this.state.form, { Title: e.target.value }) }); },
                placeholder: 'Enter form title',
                className: 'w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500',
                'aria-label': 'Form title'
              })
            ),
            React.createElement('div', null,
              React.createElement('label', { className: 'block mb-1 text-gray-700' }, 'Owners'),
              React.createElement('div', { className: 'relative' },
                React.createElement('input', {
                  type: 'text',
                  value: this.state.searchTerm,
                  onChange: function(e) { _this.setState({ searchTerm: e.target.value }); },
                  placeholder: 'Search for site members...',
                  className: 'w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500',
                  'aria-label': 'Search for site members'
                }),
                this.state.isLoadingUsers && React.createElement('div', { className: 'absolute top-2 right-2' },
                  React.createElement('i', { className: 'fas fa-spinner fa-spin' })
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
                        }, user.Id === _this.props.currentUserId ? '' : React.createElement('i', { className: 'fas fa-times' }))
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
            )
          )
        ),
        React.createElement('div', { className: 'flex flex-wrap gap-3 justify-end p-4 border-t bg-gray-50' },
          React.createElement('button', {
            type: 'button',
            className: 'bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 flex items-center' + (this.state.isSaving ? ' opacity-50 cursor-not-allowed' : ''),
            onClick: this.handleSave.bind(this),
            disabled: this.state.isSaving,
            'aria-label': 'Create form'
          },
            this.state.isSaving
              ? [React.createElement('i', { className: 'fas fa-spinner fa-spin mr-2', key: 'spinner' }), 'Creating...']
              : [React.createElement('i', { className: 'fas fa-save mr-2', key: 'save-icon' }), 'Create']
          ),
          React.createElement('button', {
            type: 'button',
            className: 'bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 flex items-center',
            onClick: this.props.onClose,
            disabled: this.state.isSaving,
            'aria-label': 'Cancel form creation'
          },
            React.createElement('i', { className: 'fas fa-times mr-2' }),
            'Cancel'
          )
        )
      )
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
      creatingForm: false,
      currentPage: window.location.pathname,
      isSidebarOpen: false  // Add sidebar state
    };
    this.loadSurveys = this.loadSurveys.bind(this);
    this.addNotification = this.addNotification.bind(this);
    this.handleDelete = this.handleDelete.bind(this);
    this.handleFilter = this.handleFilter.bind(this);
    this.toggleSidebar = this.toggleSidebar.bind(this);  // Add toggle method
  }
  toggleSidebar() {
    this.setState(prevState => ({ isSidebarOpen: !prevState.isSidebarOpen }));
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
    // Close sidebar on outside click for mobile
    document.addEventListener('click', function(e) {
      if (_this.state.isSidebarOpen && !e.target.closest('.bg-gray-800') && window.innerWidth < 768) {
        _this.toggleSidebar();
      }
    });
    setTimeout(() => {
      console.log('Main content top:', document.querySelector('main')?.getBoundingClientRect().top || 'Not rendered');
      console.log('Create New Form button top:', document.querySelector('button[aria-label="Create new form"]')?.getBoundingClientRect().top || 'Not rendered');
    }, 1000);
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
          url: window._spPageContextInfo.webAbsoluteUrl + '/_api/web/lists/getbytitle(\'SurveyResponses\')/items?$filter=SurveyID/Id eq ' + survey.Id,
          headers: { 'Accept': 'application/json; odata=verbose' },
          xhrFields: { withCredentials: true }
        }).then(function(responseData) {
          survey.responseCount = responseData.d.results.length || 0;
          return survey;
        }).catch(function(error) {
          console.error('Error fetching responses for form ' + survey.Id + ':', error);
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
      console.error('Error loading forms:', error);
      _this.addNotification('Failed to load forms: ' + (xhr.responseText || error), 'error');
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
        _this.addNotification('Form deleted successfully!');
        console.log('Form deleted:', surveyId);
        _this.loadSurveys();
      }).fail(function(xhr, status, error) {
        console.error('Error deleting form:', error);
        var errorMessage = xhr.responseText || error || 'Unknown error';
        if (xhr.status === 403) errorMessage = 'Access denied. You do not have permission to delete this form.';
        _this.addNotification('Failed to delete form: ' + errorMessage, 'error');
      });
    }).fail(function(error) {
      console.error('Error getting digest:', error);
      _this.addNotification('Failed to delete form: Unable to get request digest.', 'error');
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
    var content = React.createElement('div', { className: 'min-h-screen relative z-0' },
      React.createElement('div', { className: 'flex justify-between items-center mb-4 relative z-50' },
        React.createElement('h1', { className: 'text-2xl font-bold' }, 'Forms'),
        React.createElement('button', {
          className: 'bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 flex items-center z-50',
          onClick: function() { _this.setState({ creatingForm: true }); },
          'aria-label': 'Create new form'
        },
          React.createElement('i', { className: 'fas fa-plus mr-2' }),
          'Create New Form'
        )
      ),
      React.createElement('div', { className: 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-4' },
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
    return React.createElement('div', { className: 'min-h-screen bg-gray-100 relative' },
      React.createElement(TopNav, { 
        currentUserName: this.state.currentUserName,
        onToggleSidebar: this.toggleSidebar,
        isSidebarOpen: this.state.isSidebarOpen 
      }),
      React.createElement('div', { className: 'flex pt-16' },
        React.createElement(SideNav, { 
          isOpen: this.state.isSidebarOpen,
          onFilter: this.handleFilter.bind(this) 
        }),
        React.createElement('main', { className: 'flex-1 p-4 relative z-0 min-h-screen' }, content)
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
      }),
      this.state.creatingForm && React.createElement(CreateFormModal, {
        currentUserId: this.state.currentUserId,
        currentUserName: this.state.currentUserName,
        addNotification: this.addNotification.bind(this),
        loadSurveys: this.loadSurveys.bind(this),
        onClose: function() { _this.setState({ creatingForm: false }); }
      })
    );
  }
}

// Render the app
ReactDOM.render(React.createElement(App), document.getElementById('root'));