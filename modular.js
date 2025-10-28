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

// TopNav component
class TopNav extends React.Component {
  componentDidMount() {
    console.log('TopNav height:', document.querySelector('.bg-blue-600')?.offsetHeight || 'Not rendered');
    console.log('Ribbon height:', document.querySelector('#s4-ribbonrow')?.offsetHeight || 'No ribbon');
  }
  render() {
    return React.createElement('nav', {
      className: 'bg-blue-600 text-white p-4 flex justify-between items-center fixed top-0 left-0 right-0 z-1000 h-16'
    },
      React.createElement('div', { className: 'flex items-center' },
        React.createElement('img', {
          src: '/SiteAssets/logo.png',
          alt: 'Forms Logo',
          className: 'h-8 mr-2'
        }),
        React.createElement('div', { className: 'text-lg font-bold' }, 'Forms')
      ),
      React.createElement('div', null,
        React.createElement('span', { className: 'mr-4' }, 'Welcome, ' + this.props.currentUserName)
      )
    );
  }
}

// SideNav component
class SideNav extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isOpen: false,
      searchTerm: '',
      selectedFilter: 'All'
    };
    this.toggleSidebar = this.toggleSidebar.bind(this);
  }
  toggleSidebar() {
    this.setState(prev => ({ isOpen: !prev.isOpen }));
  }
  render() {
    const _this = this;
    return React.createElement('div', {
      className: `bg-gray-800 text-white w-64 h-screen fixed top-0 left-0 md:static md:block z-900 ${this.state.isOpen ? 'block' : 'hidden'}`
    },
      React.createElement('button', {
        className: 'md:hidden bg-blue-500 text-white px-2 py-1 rounded m-2 mt-80 z-1100 flex items-center',
        onClick: this.toggleSidebar,
        'aria-label': this.state.isOpen ? 'Collapse sidebar' : 'Expand sidebar'
      },
        React.createElement('i', { className: this.state.isOpen ? 'fas fa-times mr-2' : 'fas fa-bars mr-2' }),
        this.state.isOpen ? 'Collapse' : 'Expand'
      ),
      React.createElement('div', { className: 'p-4' },
        React.createElement('div', { className: 'mb-4' },
          React.createElement('input', {
            type: 'text',
            placeholder: 'Search forms...',
            value: this.state.searchTerm,
            onChange: e => {
              _this.setState({ searchTerm: e.target.value });
              _this.props.onFilter({ searchTerm: e.target.value, status: _this.state.selectedFilter });
            },
            className: 'w-full p-2 border rounded bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500',
            'aria-label': 'Search forms'
          })
        ),
        React.createElement('ul', { className: 'space-y-2' },
          ['All', 'Published', 'Draft', 'Upcoming', 'Running'].map(filter =>
            React.createElement('li', { key: filter },
              React.createElement('button', {
                className: `w-full text-left p-2 hover:bg-gray-700 rounded ${this.state.selectedFilter === filter ? 'bg-gray-700 font-semibold' : ''}`,
                onClick: () => {
                  _this.setState({ selectedFilter: filter });
                  _this.props.onFilter({ searchTerm: _this.state.searchTerm, status: filter });
                }
              }, filter)
            )
          )
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
                this.props.survey.Owners.results.map(owner =>
                  React.createElement('div', {
                    key: owner.Id,
                    className: 'bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm'
                  }, owner.Title)
                )
              )
            : React.createElement('span', { className: 'text-gray-500 text-sm ml-2' }, 'No owners')
        )
      ),
      React.createElement('div', { className: 'p-4 border-t bg-gray-50 flex gap-2 flex-wrap' },
        React.createElement('button', {
          className: 'bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 flex items-center',
          onClick: () => window.open('/builder.aspx?surveyId=' + this.props.survey.Id, '_blank'),
          'aria-label': 'Edit form'
        },
          React.createElement('i', { className: 'fas fa-edit mr-2' }),
          'Edit Form'
        ),
        React.createElement('button', {
          className: 'bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 flex items-center',
          onClick: () => window.open('/response.aspx?surveyId=' + this.props.survey.Id, '_blank'),
          'aria-label': 'View form report'
        },
          React.createElement('i', { className: 'fas fa-chart-bar mr-2' }),
          'View Report'
        ),
        React.createElement('button', {
          className: 'bg-purple-500 text-white px-3 py-1 rounded hover:bg-purple-600 flex items-center',
          onClick: this.props.onViewQR,
          'aria-label': 'View QR code'
        },
          React.createElement('i', { className: 'fas fa-qr-code mr-2' }),
          'QR Code'
        ),
        React.createElement('button', {
          className: 'bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600 flex items-center',
          onClick: this.props.onEditMetadata,
          'aria-label': 'Edit form metadata'
        },
          React.createElement('i', { className: 'fas fa-cog mr-2' }),
          'Edit Metadata'
        ),
        React.createElement('button', {
          className: 'bg-indigo-500 text-white px-3 py-1 rounded hover:bg-indigo-600 flex items-center',
          onClick: () => window.open('/formfiller.aspx?surveyId=' + this.props.survey.Id, '_blank'),
          'aria-label': 'Fill form'
        },
          React.createElement('i', { className: 'fas fa-pen mr-2' }),
          'Fill Form'
        ),
        this.props.survey.AuthorId === this.props.currentUserId && React.createElement('button', {
          className: 'bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 flex items-center',
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
    new QRious({
      element: document.getElementById('qr-' + this.props.survey.Id),
      value: window._spPageContextInfo.webAbsoluteUrl + '/formfiller.aspx?surveyId=' + this.props.survey.Id,
      size: 200
    });
  }
  downloadQR() {
    const canvas = document.getElementById('qr-' + this.props.survey.Id);
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = this.props.survey.Title.replace(/[^a-z0-9]/gi, '_') + '_QR.png';
    link.click();
  }
  copyURL() {
    const url = window._spPageContextInfo.webAbsoluteUrl + '/formfiller.aspx?surveyId=' + this.props.survey.Id;
    navigator.clipboard.writeText(url).then(() => {
      this.props.addNotification('URL copied to clipboard!', 'success');
    }).catch(() => {
      this.props.addNotification('Failed to copy URL.', 'error');
    });
  }
  render() {
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

// Shared People Search Function
function searchPeople(query, callback) {
  if (!query || query.trim().length < 2) {
    callback([]);
    return;
  }
  getDigest().then(digest => {
    jQuery.ajax({
      url: window._spPageContextInfo.webAbsoluteUrl + '/_api/SP.UserProfiles.PeopleManager/SearchPrincipals',
      method: 'POST',
      data: JSON.stringify({
        query: query.trim(),
        maxResults: 10,
        source: 'UsersOnly'
      }),
      headers: {
        'Accept': 'application/json; odata=verbose',
        'Content-Type': 'application/json; odata=verbose',
        'X-RequestDigest': digest
      },
      xhrFields: { withCredentials: true }
    })
    .done(data => {
      const users = (data.d.SearchPrincipals || []).map(u => ({
        Id: u.AccountName.split('|').pop(),
        Title: u.DisplayName,
        Email: u.Email
      }));
      callback(users);
    })
    .fail((xhr, status, err) => {
      console.error('People search failed:', err, xhr.responseText);
      callback([]);
    });
  });
}

// EditModal with AD/User Profile Search
class EditModal extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      form: {
        Owners: Array.isArray(this.props.survey.Owners?.results)
          ? this.props.survey.Owners.results.map(o => ({ Id: o.Id, Title: o.Title }))
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

  componentDidMount() { this._isMounted = true; }
  componentWillUnmount() { this._isMounted = false; clearTimeout(this._debounce); }

  componentDidUpdate(prevProps, prevState) {
    if (prevState.searchTerm !== this.state.searchTerm) {
      if (!this.state.searchTerm) {
        this.setState({ searchResults: [], showDropdown: false });
        return;
      }
      clearTimeout(this._debounce);
      this._debounce = setTimeout(() => {
        this.setState({ isLoadingUsers: true });
        searchPeople(this.state.searchTerm, users => {
          if (!this._isMounted) return;
          const available = users.filter(u => !this.state.form.Owners.some(o => o.Id === u.Id));
          this.setState({
            searchResults: available,
            isLoadingUsers: false,
            showDropdown: available.length > 0
          });
        });
      }, 300);
    }
  }

  handleUserSelect(user) {
    this.setState({
      form: { ...this.state.form, Owners: [...this.state.form.Owners, user] },
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
      form: { ...this.state.form, Owners: this.state.form.Owners.filter(o => o.Id !== userId) }
    });
  }

  handleSave() {
    const _this = this;
    if (this.state.form.StartDate && this.state.form.EndDate &&
        new Date(this.state.form.EndDate) <= new Date(this.state.form.StartDate)) {
      this.props.addNotification('End Date must be after Start Date.', 'error');
      return;
    }
    if (!this.state.form.Owners.some(o => o.Id === this.props.currentUserId)) {
      this.props.addNotification('You must remain an owner of the form.', 'error');
      return;
    }
    this.setState({ isSaving: true });
    getDigest().then(digest => {
      const payload = {
        '__metadata': { 'type': 'SP.Data.SurveysListItem' },
        OwnersId: { results: this.state.form.Owners.map(o => o.Id) },
        Status: this.state.form.Status
      };
      if (this.state.form.StartDate) payload.StartDate = new Date(this.state.form.StartDate).toISOString();
      if (this.state.form.EndDate) payload.EndDate = new Date(this.state.form.EndDate).toISOString();

      jQuery.ajax({
        url: window._spPageContextInfo.webAbsoluteUrl + '/_api/web/lists/getbytitle(\'Surveys\')/items(' + this.props.survey.Id + ')',
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
      }).then(() => {
        // Permissions logic (same as before)
        const original = Array.isArray(this.props.survey.Owners?.results) ? this.props.survey.Owners.results.map(o => o.Id) : [];
        const added = this.state.form.Owners.filter(o => !original.includes(o.Id)).map(o => o.Id);
        const removed = original.filter(id => !this.state.form.Owners.some(o => o.Id === id) && id !== this.props.currentUserId);

        return jQuery.ajax({
          url: window._spPageContextInfo.webAbsoluteUrl + '/_api/web/lists/getbytitle(\'Surveys\')/items(' + this.props.survey.Id + ')/breakroleinheritance(copyRoleAssignments=false, clearSubscopes=true)',
          type: 'POST',
          headers: { 'Accept': 'application/json; odata=verbose', 'X-RequestDigest': digest },
          xhrFields: { withCredentials: true }
        }).then(() => {
          const addPromises = added.map(id => jQuery.ajax({
            url: window._spPageContextInfo.webAbsoluteUrl + '/_api/web/lists/getbytitle(\'Surveys\')/items(' + this.props.survey.Id + ')/roleassignments/addroleassignment(principalid=' + id + ', roledefid=1073741827)',
            type: 'POST',
            headers: { 'Accept': 'application/json; odata=verbose', 'X-RequestDigest': digest },
            xhrFields: { withCredentials: true }
          }));
          const removePromises = removed.map(id => jQuery.ajax({
            url: window._spPageContextInfo.webAbsoluteUrl + '/_api/web/lists/getbytitle(\'Surveys\')/items(' + this.props.survey.Id + ')/roleassignments/removeroleassignment(principalid=' + id + ')',
            type: 'POST',
            headers: { 'Accept': 'application/json; odata=verbose', 'X-RequestDigest': digest },
            xhrFields: { withCredentials: true }
          }));
          return Promise.all([...addPromises, ...removePromises]);
        });
      }).then(() => {
        _this.props.addNotification('Form metadata and permissions updated successfully!');
        _this.props.loadSurveys();
        _this.props.onClose();
        _this.setState({ isSaving: false });
      }).fail(err => {
        console.error('Update failed:', err);
        _this.props.addNotification('Failed to update: ' + (err.responseText || err.message), 'error');
        _this.setState({ isSaving: false });
      });
    });
  }

  render() {
    const _this = this;
    return React.createElement('div', { className: 'fixed inset-0 flex items-center justify-center z-1200 bg-black/50' },
      React.createElement('div', { className: 'bg-white rounded-lg shadow-xl w-11/12 max-w-md sm:max-w-lg md:max-w-xl' },
        // ... (same modal structure as before)
        React.createElement('div', { className: 'p-6 max-h-96 overflow-y-auto' },
          React.createElement('div', { className: 'space-y-4' },
            React.createElement('div', null,
              React.createElement('label', { className: 'block mb-1 text-gray-700' }, 'Owners'),
              React.createElement('div', { className: 'relative' },
                React.createElement('input', {
                  type: 'text',
                  value: this.state.searchTerm,
                  onChange: e => this.setState({ searchTerm: e.target.value }),
                  placeholder: 'Search users (AD/User Profile)...',
                  className: 'w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500'
                }),
                this.state.isLoadingUsers && React.createElement('div', { className: 'absolute top-2 right-2' },
                  React.createElement('i', { className: 'fas fa-spinner fa-spin' })
                ),
                this.state.showDropdown && React.createElement('ul', {
                  className: 'absolute z-10 w-full bg-white border rounded mt-1 max-h-48 overflow-y-auto shadow-lg'
                },
                  this.state.searchResults.map(user =>
                    React.createElement('li', {
                      key: user.Id,
                      onClick: () => _this.handleUserSelect(user),
                      className: 'p-2 hover:bg-gray-100 cursor-pointer border-b last:border-b-0'
                    }, user.Title)
                  )
                )
              ),
              React.createElement('div', { className: 'mt-2 flex flex-wrap gap-2' },
                this.state.form.Owners.map(user =>
                  React.createElement('div', {
                    key: user.Id,
                    className: 'flex items-center bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm'
                  },
                    React.createElement('span', null, user.Title),
                    user.Id !== _this.props.currentUserId && React.createElement('button', {
                      type: 'button',
                      onClick: () => _this.handleUserRemove(user.Id),
                      className: 'ml-2 text-red-600 hover:text-red-800 font-bold'
                    }, React.createElement('i', { className: 'fas fa-times' }))
                  )
                )
              )
            ),
            // StartDate, EndDate, Status fields (same as before)
            // ... (omitted for brevity)
          )
        ),
        // Save/Cancel buttons
      )
    );
  }
}

// CreateFormModal with AD/User Profile Search
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

  componentDidMount() { this._isMounted = true; }
  componentWillUnmount() { this._isMounted = false; clearTimeout(this._debounce); }

  componentDidUpdate(prevProps, prevState) {
    if (prevState.searchTerm !== this.state.searchTerm) {
      if (!this.state.searchTerm) {
        this.setState({ searchResults: [], showDropdown: false });
        return;
      }
      clearTimeout(this._debounce);
      this._debounce = setTimeout(() => {
        this.setState({ isLoadingUsers: true });
        searchPeople(this.state.searchTerm, users => {
          if (!this._isMounted) return;
          const available = users.filter(u => !this.state.form.Owners.some(o => o.Id === u.Id));
          this.setState({
            searchResults: available,
            isLoadingUsers: false,
            showDropdown: available.length > 0
          });
        });
      }, 300);
    }
  }

  handleUserSelect(user) {
    this.setState({
      form: { ...this.state.form, Owners: [...this.state.form.Owners, user] },
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
      form: { ...this.state.form, Owners: this.state.form.Owners.filter(o => o.Id !== userId) }
    });
  }

  handleSave() {
    const _this = this;
    if (!this.state.form.Title.trim()) {
      this.props.addNotification('Title is required.', 'error');
      return;
    }
    if (this.state.form.StartDate && this.state.form.EndDate &&
        new Date(this.state.form.EndDate) <= new Date(this.state.form.StartDate)) {
      this.props.addNotification('End Date must be after Start Date.', 'error');
      return;
    }
    this.setState({ isSaving: true });
    let newItemId;
    getDigest().then(digest => {
      const payload = {
        '__metadata': { 'type': 'SP.Data.SurveysListItem' },
        Title: _this.state.form.Title,
        OwnersId: { results: _this.state.form.Owners.map(o => o.Id) },
        Status: 'Draft',
        SurveyJson: JSON.stringify({ title: _this.state.form.Title })
      };
      if (_this.state.form.StartDate) payload.StartDate = new Date(_this.state.form.StartDate).toISOString();
      if (_this.state.form.EndDate) payload.EndDate = new Date(_this.state.form.EndDate).toISOString();

      return jQuery.ajax({
        url: window._spPageContextInfo.webAbsoluteUrl + "/_api/web/lists/getbytitle('Surveys')/items",
        type: 'POST',
        data: JSON.stringify(payload),
        headers: {
          'Accept': 'application/json; odata=verbose',
          'Content-Type': 'application/json; odata=verbose',
          'X-RequestDigest': digest
        },
        xhrFields: { withCredentials: true }
      }).then(resp => {
        newItemId = resp.d.Id;
        console.log('New form created, ID =', newItemId);
        return jQuery.ajax({
          url: window._spPageContextInfo.webAbsoluteUrl + '/_api/web/lists/getbytitle(\'Surveys\')/items(' + newItemId + ')/breakroleinheritance(copyRoleAssignments=false, clearSubscopes=true)',
          type: 'POST',
          headers: { 'Accept': 'application/json; odata=verbose', 'X-RequestDigest': digest },
          xhrFields: { withCredentials: true }
        });
      }).then(() => {
        const addPromises = _this.state.form.Owners.map(o => jQuery.ajax({
          url: window._spPageContextInfo.webAbsoluteUrl + '/_api/web/lists/getbytitle(\'Surveys\')/items(' + newItemId + ')/roleassignments/addroleassignment(principalid=' + o.Id + ', roledefid=1073741827)',
          type: 'POST',
          headers: { 'Accept': 'application/json; odata=verbose', 'X-RequestDigest': digest },
          xhrFields: { withCredentials: true }
        }));
        return Promise.all(addPromises);
      }).then(() => {
        _this.props.addNotification('Form created successfully!');
        window.location.href = '/builder.aspx?surveyId=' + newItemId;
        _this.props.loadSurveys();
        _this.props.onClose();
        _this.setState({ isSaving: false });
      });
    }).fail(err => {
      console.error('Create failed:', err);
      _this.props.addNotification('Failed to create form: ' + (err.responseText || err.message), 'error');
      _this.setState({ isSaving: false });
    });
  }

  render() {
    const _this = this;
    return React.createElement('div', { className: 'fixed inset-0 flex items-center justify-center z-1200 bg-black/50' },
      React.createElement('div', { className: 'bg-white rounded-lg shadow-xl w-11/12 max-w-md sm:max-w-lg md:max-w-xl' },
        // ... (same modal structure)
        // Title, Owners (with search), StartDate, EndDate
        // Save/Cancel
      )
    );
  }
}

// Rest of components: FormFillerComponent, BuilderComponent, ResponseComponent, App
// ... (same as previous working version)

ReactDOM.render(React.createElement(App), document.getElementById('root'));