/*=====================================================================
  SHAREPOINT 2016 ON-PREM DASHBOARD – REACT + JSOM (FULLY FIXED)
  ----------------------------------------------------
  • Works on SP 2016 On-Prem
  • JSOM for permissions
  • surveyData column
  • NO PAGE BREAK ON TYPING
  • Debounced inputs
  • Isolated from SharePoint DOM
  • Fixed _spPageContextInfo undefined
=====================================================================*/

// -------------------------------------------------------------------
// 1. WAIT FOR SHAREPOINT CONTEXT (FIX UNDEFINED ERROR)
// -------------------------------------------------------------------
function waitForSpContext(callback) {
  if (window._spPageContextInfo && window._spPageContextInfo.webAbsoluteUrl) {
    callback();
  } else {
    console.log('Waiting for _spPageContextInfo...');
    setTimeout(() => waitForSpContext(callback), 100);
  }
}

// -------------------------------------------------------------------
// 2. SAFE URL BUILDER
// -------------------------------------------------------------------
function getSiteUrl() {
  return window._spPageContextInfo?.webAbsoluteUrl ||
         (window.location.origin + window.location.pathname.split('/').slice(0, -1).join('/'));
}

// -------------------------------------------------------------------
// 3. GET DIGEST (SAFE)
// -------------------------------------------------------------------
function getDigest() {
  return new Promise((resolve, reject) => {
    waitForSpContext(() => {
      const url = getSiteUrl() + '/_api/contextinfo';
      jQuery.ajax({
        url: url,
        method: 'POST',
        headers: { 'Accept': 'application/json; odata=verbose' },
        xhrFields: { withCredentials: true }
      }).done(data => {
        resolve(data.d.GetContextWebInformation.FormDigestValue);
      }).fail(err => {
        console.error('Digest failed:', err);
        reject(err);
      });
    });
  });
}

// -------------------------------------------------------------------
// 4. PREVENT SHAREPOINT INTERFERENCE
// -------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  SP.SOD.executeFunc('sp.js', 'SP.ClientContext', () => {
    if (window.g_wpPostbackSettings) window.g_wpPostbackSettings = null;
    if (window._spBodyOnLoadCalled) window._spBodyOnLoadCalled = false;
  });
});

document.addEventListener('focusin', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    e.stopPropagation();
  }
});

// -------------------------------------------------------------------
// 5. JSOM PERMISSIONS
// -------------------------------------------------------------------
function grantEditPermissionToOwners(itemId, ownerIds, onSuccess, onError) {
  SP.SOD.executeFunc('sp.js', 'SP.ClientContext', function () {
    const context = SP.ClientContext.get_current();
    const web = context.get_web();
    const list = web.get_lists().getByTitle('Surveys');
    const item = list.getItemById(itemId);

    item.breakRoleInheritance(true, false); // keep author

    const roleDefs = web.get_roleDefinitions();
    const editRole = roleDefs.getByType(SP.RoleType.contributor);
    const roleBinding = SP.RoleDefinitionBindingCollection.newObject(context);
    roleBinding.add(editRole);

    ownerIds.forEach(userId => {
      const user = web.get_siteUsers().getById(userId);
      item.get_roleAssignments().add(user, roleBinding);
    });

    context.load(item);
    context.executeQueryAsync(onSuccess, (sender, args) => {
      console.error('JSOM Error:', args.get_message());
      onError(args.get_message());
    });
  });
}

// -------------------------------------------------------------------
// 6. STYLES & FONT AWESOME
// -------------------------------------------------------------------
const faLink = document.createElement('link');
faLink.rel = 'stylesheet';
faLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
document.head.appendChild(faLink);

const styles = `
  #s4-ribbonrow, #s4-titlerow, #s4-leftpanel, #s4-workspace, 
  #suiteBar, #suiteBarButtons, #siteIcon, #suiteLinksBox, 
  #MSOZoneCell_WebPart, .ms-siteactions-root { display: none !important; }
  body, html { margin: 0; padding: 0; height: 100%; overflow: hidden; }
  #react-app-container { all: initial; display: block; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: #f3f4f6; z-index: 9999; }
`;
const styleSheet = document.createElement('style');
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);

// -------------------------------------------------------------------
// 7. NOTIFICATION
// -------------------------------------------------------------------
class Notification extends React.Component {
  render() {
    let className = 'fixed top-4 right-4 p-4 rounded shadow-lg text-white max-w-sm z-2000';
    if (this.props.type === 'error') className += ' bg-red-500';
    else if (this.props.type === 'warning') className += ' bg-yellow-500';
    else if (this.props.type === 'info') className += ' bg-blue-500';
    else className += ' bg-green-500';
    return React.createElement('div', { className }, this.props.message);
  }
}

// -------------------------------------------------------------------
// 8. TOP NAV
// -------------------------------------------------------------------
class TopNav extends React.Component {
  render() {
    return React.createElement('nav', {
      className: 'bg-blue-600 text-white p-4 flex justify-between items-center fixed top-0 left-0 right-0 z-1000 h-16'
    },
      React.createElement('button', {
        className: 'md:hidden text-white p-2 rounded focus:outline-none focus:ring-2 focus:ring-white z-1100',
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
        React.createElement('div', { className: 'text-lg font-bold hidden md:block' }, 'Forms')
      ),
      React.createElement('div', null,
        React.createElement('span', { className: 'mr-4 hidden md:inline' }, 'Welcome, ' + (this.props.currentUserName || 'User'))
      )
    );
  }
}

// -------------------------------------------------------------------
// 9. SIDE NAV
// -------------------------------------------------------------------
class SideNav extends React.Component {
  constructor(props) {
    super(props);
    this.state = { searchTerm: '', selectedFilter: 'All' };
  }
  render() {
    const _this = this;
    const sidebarClass = `bg-gray-800 text-white w-64 h-screen fixed top-0 left-0 md:static z-900 transform transition-transform duration-300 ease-in-out ${
      this.props.isOpen ? 'translate-x-0' : '-translate-x-full'
    } md:translate-x-0`;

    return React.createElement('div', { className: sidebarClass },
      React.createElement('div', { className: 'p-4 overflow-y-auto h-full' },
        React.createElement('div', { className: 'mb-4' },
          React.createElement('input', {
            type: 'text',
            placeholder: 'Search forms...',
            value: this.state.searchTerm,
            onChange: e => {
              _this.setState({ searchTerm: e.target.value });
              _this.props.onFilter({ searchTerm: e.target.value, status: _this.state.selectedFilter });
            },
            className: 'w-full p-2 border rounded bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500'
          })
        ),
        React.createElement('ul', { className: 'space-y-2' },
          ['All', 'Published', 'Draft', 'Upcoming', 'Running'].map(filter =>
            React.createElement('li', { key: filter },
              React.createElement('button', {
                className: `w-full text-left p-2 hover:bg-gray-700 rounded ${ _this.state.selectedFilter === filter ? 'bg-gray-700 font-semibold' : '' }`,
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

// -------------------------------------------------------------------
// 10. SURVEY CARD
// -------------------------------------------------------------------
class SurveyCard extends React.Component {
  render() {
    const start = this.props.survey.StartDate ? new Date(this.props.survey.StartDate).toLocaleDateString('en-US') : 'N/A';
    const end   = this.props.survey.EndDate   ? new Date(this.props.survey.EndDate).toLocaleDateString('en-US')   : 'N/A';
    const created = this.props.survey.Created ? new Date(this.props.survey.Created).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }) : 'N/A';

    return React.createElement('div', { className: 'bg-white rounded shadow-md hover:shadow-lg transition flex flex-col' },
      React.createElement('div', { className: 'p-4 border-b bg-gray-50' },
        React.createElement('h3', { className: 'text-lg font-semibold truncate', title: this.props.survey.Title },
          this.props.survey.Title
        )
      ),
      React.createElement('div', { className: 'p-4 flex-grow' },
        React.createElement('p', { className: 'text-gray-600 mb-2' },
          'Status: ', React.createElement('span', {
            className: this.props.survey.Status === 'Published' ? 'text-green-600 font-semibold' : 'text-gray-600'
          }, this.props.survey.Status || 'Draft')
        ),
        React.createElement('p', { className: 'text-gray-600 mb-2' }, 'Date Range: ' + start + ' - ' + end),
        React.createElement('p', { className: 'text-gray-500 text-xs mb-2' }, 'Created: ' + created),
        React.createElement('div', { className: 'mb-2' },
          React.createElement('span', { className: 'text-gray-600' }, 'Responses: '),
          React.createElement('div', {
            className: 'inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm ml-2'
          }, this.props.survey.responseCount || 0)
        ),
        React.createElement('div', { className: 'mb-2' },
          React.createElement('span', { className: 'text-gray-600' }, 'Owners: '),
          this.props.survey.Owners?.results?.length
            ? React.createElement('div', { className: 'inline-flex flex-wrap gap-2 ml-2' },
                this.props.survey.Owners.results.map(o =>
                  React.createElement('div', { key: o.Id, className: 'bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm' }, o.Title)
                )
              )
            : React.createElement('span', { className: 'text-gray-500 text-sm ml-2' }, 'No owners')
        )
      ),
      React.createElement('div', { className: 'p-4 border-t bg-gray-50 flex gap-2 flex-wrap' },
        React.createElement('button', {
          className: 'bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 flex items-center text-xs md:text-sm',
          onClick: () => window.open('/builder.aspx?surveyId=' + this.props.survey.Id, '_blank')
        }, React.createElement('i', { className: 'fas fa-edit mr-2' }), 'Edit Form'),
        React.createElement('button', {
          className: 'bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 flex items-center text-xs md:text-sm',
          onClick: () => window.open('/response.aspx?surveyId=' + this.props.survey.Id, '_blank')
        }, React.createElement('i', { className: 'fas fa-chart-bar mr-2' }), 'View Report'),
        React.createElement('button', {
          className: 'bg-purple-500 text-white px-3 py-1 rounded hover:bg-purple-600 flex items-center text-xs md:text-sm',
          onClick: this.props.onViewQR
        }, React.createElement('i', { className: 'fas fa-qrcode mr-2' }), 'QR Code'),
        React.createElement('button', {
          className: 'bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600 flex items-center text-xs md:text-sm',
          onClick: this.props.onEditMetadata
        }, React.createElement('i', { className: 'fas fa-cog mr-2' }), 'Edit Metadata'),
        React.createElement('button', {
          className: 'bg-indigo-500 text-white px-3 py-1 rounded hover:bg-indigo-600 flex items-center text-xs md:text-sm',
          onClick: () => window.open('/formfiller.aspx?surveyId=' + this.props.survey.Id, '_blank')
        }, React.createElement('i', { className: 'fas fa-pen mr-2' }), 'Fill Form'),
        this.props.survey.AuthorId === this.props.currentUserId && React.createElement('button', {
          className: 'bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 flex items-center text-xs md:text-sm',
          onClick: this.props.onDelete
        }, React.createElement('i', { className: 'fas fa-trash mr-2' }), 'Delete')
      )
    );
  }
}

// -------------------------------------------------------------------
// 11. QR MODAL
// -------------------------------------------------------------------
class QRModal extends React.Component {
  componentDidMount() {
    waitForSpContext(() => {
      new QRious({
        element: document.getElementById('qr-' + this.props.survey.Id),
        value: getSiteUrl() + '/formfiller.aspx?surveyId=' + this.props.survey.Id,
        size: 200
      });
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
    const url = getSiteUrl() + '/formfiller.aspx?surveyId=' + this.props.survey.Id;
    navigator.clipboard.writeText(url).then(() => {
      this.props.addNotification('URL copied!', 'success');
    }).catch(() => {
      this.props.addNotification('Failed to copy.', 'error');
    });
  }
  render() {
    return React.createElement('div', { className: 'fixed inset-0 flex items-center justify-center z-1200 bg-black/50' },
      React.createElement('div', { className: 'bg-white rounded-lg shadow-xl w-11/12 max-w-md sm:max-w-lg md:max-w-xl' },
        React.createElement('div', { className: 'flex justify-between items-center p-4 border-b bg-gray-100' },
          React.createElement('h2', { className: 'text-lg font-bold' }, 'QR Code'),
          React.createElement('button', {
            type: 'button',
            className: 'text-gray-600 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full w-8 h-8 flex items-center justify-center',
            onClick: this.props.onClose
          }, React.createElement('i', { className: 'fas fa-times' }))
        ),
        React.createElement('div', { className: 'p-6 flex justify-center' },
          React.createElement('canvas', { id: 'qr-' + this.props.survey.Id })
        ),
        React.createElement('div', { className: 'p-4 border-t bg-gray-50 flex justify-end gap-3' },
          React.createElement('button', {
            type: 'button',
            className: 'bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 flex items-center',
            onClick: this.copyURL.bind(this)
          }, React.createElement('i', { className: 'fas fa-copy mr-2' }), 'Copy URL'),
          React.createElement('button', {
            type: 'button',
            className: 'bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 flex items-center',
            onClick: this.downloadQR.bind(this)
          }, React.createElement('i', { className: 'fas fa-download mr-2' }), 'Download'),
          React.createElement('button', {
            type: 'button',
            className: 'bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 flex items-center',
            onClick: this.props.onClose
          }, React.createElement('i', { className: 'fas fa-times mr-2' }), 'Close')
        )
      )
    );
  }
}

// -------------------------------------------------------------------
// 12. DELETE MODAL
// -------------------------------------------------------------------
class DeleteModal extends React.Component {
  render() {
    return React.createElement('div', { className: 'fixed inset-0 flex items-center justify-center z-1200 bg-black/50' },
      React.createElement('div', { className: 'bg-white rounded-lg shadow-xl w-11/12 max-w-md sm:max-w-lg md:max-w-xl' },
        React.createElement('div', { className: 'flex justify-between items-center p-4 border-b bg-gray-100' },
          React.createElement('h2', { className: 'text-lg font-bold text-gray-800' }, 'Confirm Deletion'),
          React.createElement('button', {
            type: 'button',
            className: 'text-gray-600 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full w-8 h-8 flex items-center justify-center',
            onClick: this.props.onCancel
          }, React.createElement('i', { className: 'fas fa-times' }))
        ),
        React.createElement('div', { className: 'p-6' },
          React.createElement('p', { className: 'text-gray-600' },
            `Are you sure you want to delete "${this.props.survey.Title}"? This cannot be undone.`
          )
        ),
        React.createElement('div', { className: 'p-4 border-t bg-gray-50 flex justify-end gap-3' },
          React.createElement('button', {
            type: 'button',
            className: 'bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 flex items-center',
            onClick: this.props.onConfirm
          }, React.createElement('i', { className: 'fas fa-check mr-2' }), 'Confirm'),
          React.createElement('button', {
            type: 'button',
            className: 'bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 flex items-center',
            onClick: this.props.onCancel
          }, React.createElement('i', { className: 'fas fa-times mr-2' }), 'Cancel')
        )
      )
    );
  }
}

// -------------------------------------------------------------------
// 13. CREATE FORM MODAL – DEBOUNCED TITLE INPUT
// -------------------------------------------------------------------
class CreateFormModal extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      form: {
        Title: '',
        Owners: [{ Id: props.currentUserId, Title: props.currentUserName }],
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

  componentDidUpdate(prevProps, prevState) {
    const _this = this;
    if (prevState.searchTerm !== this.state.searchTerm && this.state.searchTerm) {
      clearTimeout(this._debounce);
      this._debounce = setTimeout(() => {
        _this.setState({ isLoadingUsers: true });
        jQuery.ajax({
          url: `${getSiteUrl()}/_api/web/siteusers?$filter=substringof('${encodeURIComponent(_this.state.searchTerm)}', Title) or substringof('${encodeURIComponent(_this.state.searchTerm)}', LoginName)&$select=Id,Title,LoginName,Email&$top=20`,
          headers: { Accept: 'application/json; odata=verbose' },
          xhrFields: { withCredentials: true }
        }).then(data => {
          const users = data.d.results.map(u => ({ Id: u.Id, Title: u.Title }));
          const available = users.filter(u => !_this.state.form.Owners.some(o => o.Id === u.Id));
          _this.setState({ searchResults: available, isLoadingUsers: false, showDropdown: true });
        }).catch(() => _this.setState({ isLoadingUsers: false, showDropdown: false }));
      }, 300);
    } else if (!this.state.searchTerm) {
      this.setState({ searchResults: [], showDropdown: false });
    }
  }

  handleUserSelect(user) {
    this.setState({
      form: { ...this.state.form, Owners: this.state.form.Owners.concat([user]) },
      searchTerm: '',
      showDropdown: false
    });
  }

  handleUserRemove(id) {
    if (id === this.props.currentUserId) {
      this.props.addNotification('You cannot remove yourself.', 'error');
      return;
    }
    this.setState({
      form: { ...this.state.form, Owners: this.state.form.Owners.filter(o => o.Id !== id) }
    });
  }

  handleSave() {
    const _this = this;
    if (!this.state.form.Title.trim()) return _this.props.addNotification('Title required.', 'error');
    if (this.state.form.StartDate && this.state.form.EndDate &&
        new Date(this.state.form.EndDate) <= new Date(this.state.form.StartDate))
      return _this.props.addNotification('End Date must be after Start Date.', 'error');

    this.setState({ isSaving: true });

    getDigest().then(digest => {
      const payload = {
        __metadata: { type: 'SP.Data.SurveysListItem' },
        Title: _this.state.form.Title,
        OwnersId: { results: _this.state.form.Owners.map(o => o.Id) },
        Status: 'Draft',
        surveyData: JSON.stringify({ title: _this.state.form.Title })
      };
      if (_this.state.form.StartDate) payload.StartDate = new Date(_this.state.form.StartDate).toISOString();
      if (_this.state.form.EndDate)   payload.EndDate   = new Date(_this.state.form.EndDate).toISOString();

      return jQuery.ajax({
        url: `${getSiteUrl()}/_api/web/lists/getbytitle('Surveys')/items`,
        type: 'POST',
        data: JSON.stringify(payload),
        headers: {
          Accept: 'application/json; odata=verbose',
          'Content-Type': 'application/json; odata=verbose',
          'X-RequestDigest': digest
        },
        xhrFields: { withCredentials: true }
      });
    }).then(resp => {
      const newItemId = resp.d.Id;

      grantEditPermissionToOwners(
        newItemId,
        _this.state.form.Owners.map(o => o.Id),
        () => {
          _this.props.addNotification('Form created! All owners have access.', 'success');
          window.open(`/builder.aspx?surveyId=${newItemId}`, '_blank');
          _this.props.loadSurveys();
          _this.props.onClose();
          _this.setState({ isSaving: false });
        },
        err => {
          _this.props.addNotification('Permission failed: ' + err, 'error');
          _this.setState({ isSaving: false });
        }
      );
    }).catch(err => {
      console.error(err);
      _this.props.addNotification('Failed to create form.', 'error');
      _this.setState({ isSaving: false });
    });
  }

  render() {
    const _this = this;

    // DEBOUNCED TITLE INPUT
    const titleInput = (function() {
      let timeout;
      return {
        type: 'text',
        value: _this.state.form.Title,
        onChange: function(e) {
          clearTimeout(timeout);
          const value = e.target.value;
          timeout = setTimeout(() => {
            _this.setState(prev => ({ form: { ...prev.form, Title: value } }));
          }, 50);
        },
        className: 'w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500',
        placeholder: 'Enter form title...'
      };
    })();

    return React.createElement('div', { className: 'fixed inset-0 flex items-center justify-center z-1200 bg-black/50' },
      React.createElement('div', { className: 'bg-white rounded-lg shadow-xl w-11/12 max-w-md sm:max-w-lg md:max-w-xl' },
        React.createElement('div', { className: 'flex justify-between items-center p-4 border-b bg-gray-100' },
          React.createElement('h2', { className: 'text-lg font-bold text-gray-800' }, 'Create New Form'),
          React.createElement('button', {
            type: 'button',
            className: 'text-gray-600 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full w-8 h-8 flex items-center justify-center',
            onClick: this.props.onClose
          }, React.createElement('i', { className: 'fas fa-times' }))
        ),
        React.createElement('div', { className: 'p-6 max-h-96 overflow-y-auto' },
          React.createElement('div', { className: 'space-y-4' },
            React.createElement('div', null,
              React.createElement('label', { className: 'block mb-1 text-gray-700' }, 'Title *'),
              React.createElement('input', titleInput)
            ),
            React.createElement('div', null,
              React.createElement('label', { className: 'block mb-1 text-gray-700' }, 'Owners'),
              React.createElement('div', { className: 'relative' },
                React.createElement('input', {
                  type: 'text',
                  value: this.state.searchTerm,
                  onChange: e => _this.setState({ searchTerm: e.target.value }),
                  placeholder: 'Search users...',
                  className: 'w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500'
                }),
                this.state.isLoadingUsers && React.createElement('div', { className: 'absolute top-2 right-2' },
                  React.createElement('i', { className: 'fas fa-spinner fa-spin' })
                ),
                this.state.showDropdown && this.state.searchResults.length > 0 && React.createElement('ul', {
                  className: 'absolute z-10 w-full bg-white border rounded mt-1 max-h-48 overflow-y-auto shadow-lg'
                },
                  this.state.searchResults.map(u =>
                    React.createElement('li', {
                      key: u.Id,
                      onClick: () => _this.handleUserSelect(u),
                      className: 'p-2 hover:bg-gray-100 cursor-pointer border-b last:border-b-0'
                    }, u.Title)
                  )
                )
              ),
              React.createElement('div', { className: 'mt-2 flex flex-wrap gap-2' },
                this.state.form.Owners.map(o =>
                  React.createElement('div', { key: o.Id, className: 'flex items-center bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm' },
                    React.createElement('span', null, o.Title),
                    o.Id !== _this.props.currentUserId && React.createElement('button', {
                      type: 'button',
                      onClick: () => _this.handleUserRemove(o.Id),
                      className: 'ml-2 text-red-600 hover:text-red-800 font-bold'
                    }, React.createElement('i', { className: 'fas fa-times' }))
                  )
                )
              )
            ),
            React.createElement('div', null,
              React.createElement('label', { className: 'block mb-1 text-gray-700' }, 'Start Date'),
              React.createElement('input', {
                type: 'date',
                value: this.state.form.StartDate,
                onChange: e => _this.setState({ form: { ..._this.state.form, StartDate: e.target.value } }),
                className: 'w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500'
              })
            ),
            React.createElement('div', null,
              React.createElement('label', { className: 'block mb-1 text-gray-700' }, 'End Date'),
              React.createElement('input', {
                type: 'date',
                value: this.state.form.EndDate,
                onChange: e => _this.setState({ form: { ..._this.state.form, EndDate: e.target.value } }),
                className: 'w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500'
              })
            )
          )
        ),
        React.createElement('div', { className: 'flex flex-wrap gap-3 justify-end p-4 border-t bg-gray-50' },
          React.createElement('button', {
            type: 'button',
            className: `bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 flex items-center ${this.state.isSaving ? 'opacity-50 cursor-not-allowed' : ''}`,
            onClick: this.handleSave,
            disabled: this.state.isSaving
          },
            this.state.isSaving
              ? [React.createElement('i', { className: 'fas fa-spinner fa-spin mr-2', key: 'spin' }), 'Creating...']
              : [React.createElement('i', { className: 'fas fa-save mr-2', key: 'save' }), 'Create']
          ),
          React.createElement('button', {
            type: 'button',
            className: 'bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 flex items-center',
            onClick: this.props.onClose,
            disabled: this.state.isSaving
          }, React.createElement('i', { className: 'fas fa-times mr-2' }), 'Cancel')
        )
      )
    );
  }
}

// -------------------------------------------------------------------
// 14. EDIT METADATA MODAL – DEBOUNCED TITLE INPUT
// -------------------------------------------------------------------
class EditModal extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      form: {
        Title: props.survey.Title || '',
        Owners: (props.survey.Owners?.results || []).map(o => ({ Id: o.Id, Title: o.Title })),
        StartDate: props.survey.StartDate ? new Date(props.survey.StartDate).toISOString().split('T')[0] : '',
        EndDate:   props.survey.EndDate   ? new Date(props.survey.EndDate).toISOString().split('T')[0]   : '',
        Status:    props.survey.Status || 'Draft'
      },
      searchTerm: '',
      searchResults: [],
      isLoadingUsers: false,
      showDropdown: false,
      isSaving: false
    };
    this.handleUserSelect = this.handleUserSelect.bind(this);
    this.handleUserRemove = this.handleUserRemove.bind(this);
    this.handleSave = this.handleSave.bind(this);
  }

  componentDidUpdate(prevProps, prevState) {
    const _this = this;
    if (prevState.searchTerm !== this.state.searchTerm && this.state.searchTerm) {
      clearTimeout(this._debounce);
      this._debounce = setTimeout(() => {
        _this.setState({ isLoadingUsers: true });
        jQuery.ajax({
          url: `${getSiteUrl()}/_api/web/siteusers?$filter=substringof('${encodeURIComponent(_this.state.searchTerm)}', Title) or substringof('${encodeURIComponent(_this.state.searchTerm)}', LoginName)&$select=Id,Title,LoginName,Email&$top=20`,
          headers: { Accept: 'application/json; odata=verbose' },
          xhrFields: { withCredentials: true }
        }).then(data => {
          const users = data.d.results.map(u => ({ Id: u.Id, Title: u.Title }));
          const available = users.filter(u => !_this.state.form.Owners.some(o => o.Id === u.Id));
          _this.setState({ searchResults: available, isLoadingUsers: false, showDropdown: true });
        }).catch(() => _this.setState({ isLoadingUsers: false, showDropdown: false }));
      }, 300);
    } else if (!this.state.searchTerm) {
      this.setState({ searchResults: [], showDropdown: false });
    }
  }

  handleUserSelect(user) {
    this.setState({
      form: { ...this.state.form, Owners: this.state.form.Owners.concat([user]) },
      searchTerm: '',
      showDropdown: false
    });
  }

  handleUserRemove(id) {
    if (id === this.props.currentUserId) {
      this.props.addNotification('You cannot remove yourself.', 'error');
      return;
    }
    this.setState({
      form: { ...this.state.form, Owners: this.state.form.Owners.filter(o => o.Id !== id) }
    });
  }

  handleSave() {
    const _this = this;
    if (!this.state.form.Title.trim()) return _this.props.addNotification('Title required.', 'error');
    if (this.state.form.StartDate && this.state.form.EndDate &&
        new Date(this.state.form.EndDate) <= new Date(this.state.form.StartDate))
      return _this.props.addNotification('End Date must be after Start Date.', 'error');

    const isAuthor = _this.props.survey.AuthorId === _this.props.currentUserId;
    this.setState({ isSaving: true });

    getDigest().then(digest => {
      const payload = {
        __metadata: { type: 'SP.Data.SurveysListItem' },
        Title: _this.state.form.Title,
        Status: _this.state.form.Status
      };
      if (_this.state.form.StartDate) payload.StartDate = new Date(_this.state.form.StartDate).toISOString();
      if (_this.state.form.EndDate)   payload.EndDate   = new Date(_this.state.form.EndDate).toISOString();
      if (isAuthor) payload.OwnersId = { results: _this.state.form.Owners.map(o => o.Id) };

      return jQuery.ajax({
        url: `${getSiteUrl()}/_api/web/lists/getbytitle('Surveys')/items(${_this.props.survey.Id})`,
        type: 'POST',
        data: JSON.stringify(payload),
        headers: {
          Accept: 'application/json; odata=verbose',
          'Content-Type': 'application/json; odata=verbose',
          'X-HTTP-Method': 'MERGE',
          'If-Match': '*',
          'X-RequestDigest': digest
        },
        xhrFields: { withCredentials: true }
      });
    }).then(() => {
      grantEditPermissionToOwners(
        _this.props.survey.Id,
        _this.state.form.Owners.map(o => o.Id),
        () => {
          _this.props.addNotification('Form updated! All owners have access.', 'success');
          setTimeout(() => _this.props.loadSurveys(), 1000);
          _this.props.onClose();
          _this.setState({ isSaving: false });
        },
        err => {
          _this.props.addNotification('Permission failed: ' + err, 'error');
          _this.setState({ isSaving: false });
        }
      );
    }).catch(err => {
      console.error(err);
      _this.props.addNotification('Save failed.', 'error');
      _this.setState({ isSaving: false });
    });
  }

  render() {
    const _this = this;
    const isAuthor = this.props.survey.AuthorId === this.props.currentUserId;

    // DEBOUNCED TITLE INPUT
    const titleInput = (function() {
      let timeout;
      return {
        type: 'text',
        value: _this.state.form.Title,
        onChange: function(e) {
          clearTimeout(timeout);
          const value = e.target.value;
          timeout = setTimeout(() => {
            _this.setState(prev => ({ form: { ...prev.form, Title: value } }));
          }, 50);
        },
        className: 'w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500'
      };
    })();

    return React.createElement('div', { className: 'fixed inset-0 flex items-center justify-center z-1200 bg-black/50' },
      React.createElement('div', { className: 'bg-white rounded-lg shadow-xl w-11/12 max-w-md sm:max-w-lg md:max-w-xl' },
        React.createElement('div', { className: 'flex justify-between items-center p-4 border-b bg-gray-100' },
          React.createElement('h2', { className: 'text-lg font-bold text-gray-800' }, 'Edit Form'),
          React.createElement('button', {
            type: 'button',
            className: 'text-gray-600 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full w-8 h-8 flex items-center justify-center',
            onClick: this.props.onClose
          }, React.createElement('i', { className: 'fas fa-times' }))
        ),
        React.createElement('div', { className: 'p-6 max-h-96 overflow-y-auto' },
          React.createElement('div', { className: 'space-y-4' },
            React.createElement('div', null,
              React.createElement('label', { className: 'block mb-1 text-gray-700' }, 'Title *'),
              React.createElement('input', titleInput)
            ),
            React.createElement('div', null,
              React.createElement('label', { className: 'block mb-1 text-gray-700' }, 'Owners'),
              isAuthor
                ? React.createElement('div', { className: 'space-y-2' },
                    React.createElement('div', { className: 'relative' },
                      React.createElement('input', {
                        type: 'text',
                        value: this.state.searchTerm,
                        onChange: e => _this.setState({ searchTerm: e.target.value }),
                        placeholder: 'Search users...',
                        className: 'w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500'
                      }),
                      this.state.isLoadingUsers && React.createElement('div', { className: 'absolute top-2 right-2' },
                        React.createElement('i', { className: 'fas fa-spinner fa-spin' })
                      ),
                      this.state.showDropdown && this.state.searchResults.length > 0 && React.createElement('ul', {
                        className: 'absolute z-10 w-full bg-white border rounded mt-1 max-h-48 overflow-y-auto shadow-lg'
                      },
                        this.state.searchResults.map(u =>
                          React.createElement('li', {
                            key: u.Id,
                            onClick: () => _this.handleUserSelect(u),
                            className: 'p-2 hover:bg-gray-100 cursor-pointer border-b last:border-b-0'
                          }, u.Title)
                        )
                      )
                    ),
                    React.createElement('div', { className: 'flex flex-wrap gap-2 mt-2' },
                      this.state.form.Owners.map(o =>
                        React.createElement('div', { key: o.Id, className: 'flex items-center bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm' },
                          React.createElement('span', null, o.Title),
                          o.Id !== _this.props.currentUserId && React.createElement('button', {
                            type: 'button',
                            onClick: () => _this.handleUserRemove(o.Id),
                            className: 'ml-2 text-red-600 hover:text-red-800 font-bold'
                          }, React.createElement('i', { className: 'fas fa-times' }))
                        )
                      )
                    )
                  )
                : React.createElement('div', { className: 'bg-gray-100 p-3 rounded text-sm text-gray-600' },
                    'Only the form author can modify owners.',
                    React.createElement('div', { className: 'mt-2 flex flex-wrap gap-1' },
                      this.state.form.Owners.map(o =>
                        React.createElement('span', { key: o.Id, className: 'bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs' }, o.Title)
                      )
                    )
                  )
            ),
            React.createElement('div', null,
              React.createElement('label', { className: 'block mb-1 text-gray-700' }, 'Start Date'),
              React.createElement('input', {
                type: 'date',
                value: this.state.form.StartDate,
                onChange: e => _this.setState({ form: { ..._this.state.form, StartDate: e.target.value } }),
                className: 'w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500'
              })
            ),
            React.createElement('div', null,
              React.createElement('label', { className: 'block mb-1 text-gray-700' }, 'End Date'),
              React.createElement('input', {
                type: 'date',
                value: this.state.form.EndDate,
                onChange: e => _this.setState({ form: { ..._this.state.form, EndDate: e.target.value } }),
                className: 'w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500'
              })
            ),
            React.createElement('div', null,
              React.createElement('label', { className: 'block mb-1 text-gray-700' }, 'Status'),
              React.createElement('select', {
                value: this.state.form.Status,
                onChange: e => _this.setState({ form: { ..._this.state.form, Status: e.target.value } }),
                className: 'w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500'
              },
                React.createElement('option', { value: 'Draft' }, 'Draft'),
                React.createElement('option', { value: 'Published' }, 'Published')
              )
            )
          )
        ),
        React.createElement('div', { className: 'flex flex-wrap gap-3 justify-end p-4 border-t bg-gray-50' },
          React.createElement('button', {
            type: 'button',
            className: `bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 flex items-center ${this.state.isSaving ? 'opacity-50 cursor-not-allowed' : ''}`,
            onClick: this.handleSave,
            disabled: this.state.isSaving
          },
            this.state.isSaving
              ? [React.createElement('i', { className: 'fas fa-spinner fa-spin mr-2', key: 'spin' }), 'Saving...']
              : [React.createElement('i', { className: 'fas fa-save mr-2', key: 'save' }), 'Save']
          ),
          React.createElement('button', {
            type: 'button',
            className: 'bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 flex items-center',
            onClick: this.props.onClose,
            disabled: this.state.isSaving
          }, React.createElement('i', { className: 'fas fa-times mr-2' }), 'Cancel')
        )
      )
    );
  }
}

// -------------------------------------------------------------------
// 15. MAIN APP
// -------------------------------------------------------------------
class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      surveys: [], filteredSurveys: [], currentUserId: null, currentUserName: null,
      notifications: [], editingSurvey: null, viewingQR: null, deletingSurvey: null,
      creatingForm: false, isSidebarOpen: false
    };
    this.toggleSidebar = this.toggleSidebar.bind(this);
    this.loadSurveys = this.loadSurveys.bind(this);
    this.addNotification = this.addNotification.bind(this);
    this.handleDelete = this.handleDelete.bind(this);
    this.handleFilter = this.handleFilter.bind(this);
  }

  toggleSidebar() {
    this.setState(prev => ({ isSidebarOpen: !prev.isSidebarOpen }));
  }

  componentDidMount() {
    waitForSpContext(() => {
      jQuery.ajax({
        url: getSiteUrl() + '/_api/web/currentuser',
        headers: { Accept: 'application/json; odata=verbose' },
        xhrFields: { withCredentials: true }
      }).done(d => this.setState({ currentUserId: d.d.Id, currentUserName: d.d.Title }, this.loadSurveys));
    });
  }

  loadSurveys() {
    waitForSpContext(() => {
      jQuery.ajax({
        url: getSiteUrl() + '/_api/web/lists/getbytitle(\'Surveys\')/items?$select=Id,Title,Owners/Id,Owners/Title,StartDate,EndDate,Status,AuthorId,Created&$expand=Owners',
        headers: { Accept: 'application/json; odata=verbose' },
        xhrFields: { withCredentials: true }
      }).done(data => {
        let surveys = data.d.results;
        surveys.sort((a, b) => new Date(b.Created) - new Date(a.Created));

        Promise.all(surveys.map(s =>
          jQuery.ajax({
            url: getSiteUrl() + '/_api/web/lists/getbytitle(\'SurveyResponses\')/items?$filter=SurveyID/Id eq ' + s.Id,
            headers: { Accept: 'application/json; odata=verbose' },
            xhrFields: { withCredentials: true }
          }).then(r => {
            s.responseCount = r.d.results.length || 0;
            return s;
          }).catch(() => { s.responseCount = 0; return s; })
        )).then(updated => {
          this.setState({ surveys: updated, filteredSurveys: updated });
        });
      }).fail(() => this.addNotification('Failed to load forms.', 'error'));
    });
  }

  addNotification(msg, type = 'success') {
    const id = Date.now();
    this.setState(s => ({ notifications: s.notifications.concat([{ id, msg, type }]) }));
    setTimeout(() => this.setState(s => ({ notifications: s.notifications.filter(n => n.id !== id) })), 5000);
  }

  handleDelete(id) {
    this.setState({ deletingSurvey: null });
    getDigest().then(digest => jQuery.ajax({
      url: getSiteUrl() + '/_api/web/lists/getbytitle(\'Surveys\')/items(' + id + ')',
      type: 'POST',
      headers: { 'X-HTTP-Method': 'DELETE', 'If-Match': '*', 'X-RequestDigest': digest },
      xhrFields: { withCredentials: true }
    }).done(() => { this.addNotification('Form deleted!'); this.loadSurveys(); })
      .fail(() => this.addNotification('Delete failed.', 'error')));
  }

  handleFilter({ searchTerm, status }) {
    let filtered = [...this.state.surveys];
    if (searchTerm) filtered = filtered.filter(s => s.Title.toLowerCase().includes(searchTerm.toLowerCase()));
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (status !== 'All') {
      filtered = filtered.filter(s => {
        const start = s.StartDate ? new Date(s.StartDate) : null;
        const end   = s.EndDate   ? new Date(s.EndDate)   : null;
        switch (status) {
          case 'Published': return s.Status === 'Published';
          case 'Draft':     return s.Status === 'Draft';
          case 'Upcoming':  return start && start > today;
          case 'Running':   return start && end && start <= today && end >= today && s.Status === 'Published';
          default: return true;
        }
      });
    }
    this.setState({ filteredSurveys: filtered });
  }

  render() {
    const _this = this;
    const content = React.createElement('div', { className: 'min-h-screen relative z-0' },
      React.createElement('div', { className: 'flex justify-between items-center mb-4' },
        React.createElement('h1', { className: 'text-2xl font-bold' }, 'Forms'),
        React.createElement('button', {
          className: 'bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 flex items-center',
          onClick: () => _this.setState({ creatingForm: true })
        }, React.createElement('i', { className: 'fas fa-plus mr-2' }), 'Create New Form')
      ),
      React.createElement('div', { className: 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-4' },
        this.state.filteredSurveys.map(s =>
          React.createElement(SurveyCard, {
            key: s.Id,
            survey: s,
            currentUserId: _this.state.currentUserId,
            onEditMetadata: () => _this.setState({ editingSurvey: s }),
            onViewQR: () => _this.setState({ viewingQR: s }),
            onDelete: () => _this.setState({ deletingSurvey: s }),
            addNotification: _this.addNotification.bind(_this)
          })
        )
      )
    );

    return React.createElement('div', { className: 'min-h-screen bg-gray-100 relative' },
      React.createElement(TopNav, {
        currentUserName: this.state.currentUserName,
        onToggleSidebar: this.toggleSidebar,
        isSidebarOpen: this.state.isSidebarOpen
      }),
      React.createElement('div', { className: 'flex pt-16' },
        React.createElement(SideNav, { isOpen: this.state.isSidebarOpen, onFilter: this.handleFilter.bind(this) }),
        React.createElement('main', { className: 'flex-1 p-4 min-h-screen' }, content)
      ),
      this.state.notifications.map(n => React.createElement(Notification, { key: n.id, message: n.msg, type: n.type })),
      this.state.editingSurvey && React.createElement(EditModal, {
        survey: this.state.editingSurvey,
        currentUserId: this.state.currentUserId,
        addNotification: this.addNotification.bind(this),
        loadSurveys: this.loadSurveys,
        onClose: () => _this.setState({ editingSurvey: null })
      }),
      this.state.viewingQR && React.createElement(QRModal, {
        survey: this.state.viewingQR,
        addNotification: this.addNotification.bind(this),
        onClose: () => _this.setState({ viewingQR: null })
      }),
      this.state.deletingSurvey && React.createElement(DeleteModal, {
        survey: this.state.deletingSurvey,
        onConfirm: () => _this.handleDelete(_this.state.deletingSurvey.Id),
        onCancel: () => _this.setState({ deletingSurvey: null })
      }),
      this.state.creatingForm && React.createElement(CreateFormModal, {
        currentUserId: this.state.currentUserId,
        currentUserName: this.state.currentUserName,
        addNotification: this.addNotification.bind(this),
        loadSurveys: this.loadSurveys,
        onClose: () => _this.setState({ creatingForm: false })
      })
    );
  }
}

// -------------------------------------------------------------------
// RENDER AFTER SP.JS
// -------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  SP.SOD.executeFunc('sp.js', 'SP.ClientContext', () => {
    const root = document.getElementById('root');
    if (root) {
      ReactDOM.render(React.createElement(App), root);
    }
  });
});