/*=====================================================================
  SHAREPOINT 2016 ON-PREM DASHBOARD – FINAL (GUID + FULL CONTROL)
  ----------------------------------------------------
  • REST-only permissions (NO JSOM, NO SOAP)
  • ITEM: Full Control (1073741829) | LIST: Read (1073741826)
  • ANY OWNER can add/remove other owners
  • CANNOT remove self
  • REMOVED OWNERS LOSE ACCESS (permissions revoked)
  • BREAK INHERITANCE ON CREATE
  • GUID ROUTING: FormGUID (UUID) used in URLs
  • GUID GENERATED ON CREATE
  • "Read all items" REQUIRED in list settings
  • Client-side filtering: Author OR Owner
  • 100% SP 2016 On-Prem tested
=====================================================================*/

// -------------------------------------------------------------------
// 1. GLOBAL URL HELPER
// -------------------------------------------------------------------
function spUrl(path = '') {
  const base = window._spPageContextInfo?.webAbsoluteUrl ||
               (window.location.origin + window.location.pathname.split('/').slice(0, -1).join('/'));
  return base.replace(/\/+$/, '') + '/' + path.replace(/^\/+/, '');
}

// -------------------------------------------------------------------
// 2. CACHED DIGEST
// -------------------------------------------------------------------
let _digestCache = { value: null, expires: 0 };
function getDigest() {
  return new Promise((resolve, reject) => {
    const now = Date.now();
    if (_digestCache.value && now < _digestCache.expires) {
      return resolve(_digestCache.value);
    }
    $.ajax({
      url: spUrl('_api/contextinfo'),
      method: 'POST',
      headers: { Accept: 'application/json; odata=verbose' },
      xhrFields: { withCredentials: true }
    })
      .done(d => {
        const value = d.d.GetContextWebInformation.FormDigestValue;
        _digestCache = { value, expires: now + 30 * 1000 };
        resolve(value);
      })
      .fail(reject);
  });
}

// -------------------------------------------------------------------
// 3. PREVENT SHAREPOINT INTERFERENCE
// -------------------------------------------------------------------
$(document).on('focusin', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') e.stopPropagation();
});
$(document).ready(() => {
  if (window.g_wpPostbackSettings) window.g_wpPostbackSettings = null;
  if (window._spBodyOnLoadCalled) window._spBodyOnLoadCalled = false;
});

// -------------------------------------------------------------------
// 4. UUID GENERATOR (RFC 4122 v4)
// -------------------------------------------------------------------
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// -------------------------------------------------------------------
// 5. REST-ONLY PERMISSIONS – FULL CONTROL + REMOVE + BREAK INHERITANCE
// -------------------------------------------------------------------
function grantEditPermissionToOwners(itemId, newOwnerIds, oldOwnerIds, onSuccess, onError) {
  const oldIds = Array.isArray(oldOwnerIds) ? oldOwnerIds : [];

  if (!newOwnerIds.length && !oldIds.length) return onSuccess();

  getDigest().then(digest => {
    const listUrl = spUrl(`_api/web/lists/getbytitle('Surveys')`);
    const itemUrl = listUrl + `/items(${itemId})`;

    const promises = [];

    // ADD FULL CONTROL to NEW owners (ITEM)
    newOwnerIds.forEach(id => {
      promises.push(
        $.ajax({
          url: itemUrl + `/roleassignments/addroleassignment(principalid=${id}, roledefid=1073741829)`,
          method: 'POST',
          headers: { 'X-RequestDigest': digest },
          xhrFields: { withCredentials: true }
        })
      );
    });

    // REMOVE FULL CONTROL from REMOVED owners (ITEM)
    oldIds.forEach(id => {
      promises.push(
        $.ajax({
          url: itemUrl + `/roleassignments/removeroleassignment(principalid=${id}, roledefid=1073741829)`,
          method: 'POST',
          headers: { 'X-RequestDigest': digest },
          xhrFields: { withCredentials: true }
        }).fail(() => {
          return $.ajax({
            url: listUrl + `/roleassignments/removeroleassignment(principalid=${id}, roledefid=1073741826)`,
            method: 'POST',
            headers: { 'X-RequestDigest': digest },
            xhrFields: { withCredentials: true }
          });
        })
      );
    });

    // ADD READ to NEW owners (LIST)
    newOwnerIds.forEach(id => {
      promises.push(
        $.ajax({
          url: listUrl + `/roleassignments/addroleassignment(principalid=${id}, roledefid=1073741826)`,
          method: 'POST',
          headers: { 'X-RequestDigest': digest },
          xhrFields: { withCredentials: true }
        })
      );
    });

    // REMOVE READ from REMOVED owners (LIST)
    oldIds.forEach(id => {
      promises.push(
        $.ajax({
          url: listUrl + `/roleassignments/removeroleassignment(principalid=${id}, roledefid=1073741826)`,
          method: 'POST',
          headers: { 'X-RequestDigest': digest },
          xhrFields: { withCredentials: true }
        })
      );
    });

    Promise.all(promises)
      .then(onSuccess)
      .catch(err => {
        console.error('Permission update failed:', err);
        onError(err);
      });
  });
}

// -------------------------------------------------------------------
// 6. STYLES & FONT AWESOME
// -------------------------------------------------------------------
$('<link>', {
  rel: 'stylesheet',
  href: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
}).appendTo('head');

$('<style>').text(`
  #s4-ribbonrow,#s4-titlerow,#s4-leftpanel,#s4-workspace,
  #suiteBar,#suiteBarButtons,#siteIcon,#suiteLinksBox,
  #MSOZoneCell_WebPart,.ms-siteactions-root{display:none!important}
  body,html{margin:0;padding:0;height:100%;overflow:hidden}
  #react-app-container{position:fixed;top:0;left:0;width:100%;height:100%;
    background:#f3f4f6;z-index:9999;display:block}
`).appendTo('head');

// -------------------------------------------------------------------
// 7. NOTIFICATION
// -------------------------------------------------------------------
class Notification extends React.Component {
  render() {
    const base = 'fixed top-4 right-4 p-4 rounded shadow-lg text-white max-w-sm z-2000';
    const colors = { error: 'bg-red-500', warning: 'bg-yellow-500', info: 'bg-blue-500' };
    return React.createElement('div', { className: `${base} ${colors[this.props.type] || 'bg-green-500'}` },
      this.props.message);
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
        className: 'md:hidden text-white p-2 rounded focus:outline-none focus:ring-2 focus:ring-white',
        onClick: this.props.onToggleSidebar,
        'aria-label': this.props.isSidebarOpen ? 'Close' : 'Open'
      }, React.createElement('i', { className: this.props.isSidebarOpen ? 'fas fa-times' : 'fas fa-bars' })),
      React.createElement('div', { className: 'flex items-center flex-1 justify-center md:justify-start' },
        React.createElement('img', { src: '/SiteAssets/logo.png', alt: 'Logo', className: 'h-8 mr-2' }),
        React.createElement('div', { className: 'text-lg font-bold hidden md:block' }, 'Forms')
      ),
      React.createElement('div', null,
        React.createElement('span', { className: 'mr-4 hidden md:inline' },
          'Welcome, ' + (this.props.currentUserName || 'User'))
      )
    );
  }
}

// -------------------------------------------------------------------
// 9. SIDE NAV
// -------------------------------------------------------------------
class SideNav extends React.Component {
  constructor(p) { super(p); this.state = { searchTerm: '', filter: 'All' }; }
  render() {
    const _ = this;
    const sidebar = `bg-gray-800 text-white w-64 h-screen fixed top-0 left-0 md:static z-900 transform transition-transform duration-300 ease-in-out ${
      this.props.isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`;

    return React.createElement('div', { className: sidebar },
      React.createElement('div', { className: 'p-4 overflow-y-auto h-full' },
        React.createElement('input', {
          type: 'text', placeholder: 'Search forms...',
          value: this.state.searchTerm,
          onChange: e => { _.setState({ searchTerm: e.target.value }); _.props.onFilter(e.target.value, _.state.filter); },
          className: 'w-full p-2 border rounded bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500'
        }),
        React.createElement('ul', { className: 'mt-4 space-y-2' },
          ['All','Published','Draft','Upcoming','Running'].map(f =>
            React.createElement('li', { key: f },
              React.createElement('button', {
                className: `w-full text-left p-2 rounded ${_.state.filter===f?'bg-gray-700 font-semibold':''} hover:bg-gray-700`,
                onClick: () => { _.setState({ filter: f }); _.props.onFilter(_.state.searchTerm, f); }
              }, f)
            )
          )
        )
      )
    );
  }
}

// -------------------------------------------------------------------
// 10. SURVEY CARD – USES FormGUID FOR ROUTING
// -------------------------------------------------------------------
class SurveyCard extends React.Component {
  render() {
    const s = this.props.survey;
    const fmt = d => d ? new Date(d).toLocaleDateString('en-US') : 'N/A';
    const created = s.Created ? new Date(s.Created).toLocaleString('en-US', { month:'short', day:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit' }) : 'N/A';

    return React.createElement('div', { className: 'bg-white rounded shadow-md hover:shadow-lg flex flex-col' },
      React.createElement('div', { className: 'p-4 border-b bg-gray-50' },
        React.createElement('h3', { className: 'text-lg font-semibold truncate', title: s.Title }, s.Title)
      ),
      React.createElement('div', { className: 'p-4 flex-grow' },
        React.createElement('p', { className: 'text-gray-600 mb-2' },
          'Status: ', React.createElement('span', { className: s.Status==='Published'?'text-green-600 font-semibold':'text-gray-600' }, s.Status||'Draft')
        ),
        React.createElement('p', { className: 'text-gray-600 mb-2' }, 'Date Range: '+fmt(s.StartDate)+' - '+fmt(s.EndDate)),
        React.createElement('p', { className: 'text-gray-500 text-xs mb-2' }, 'Created: '+created),
        React.createElement('div', { className: 'mb-2' },
          React.createElement('span', { className: 'text-gray-600' }, 'Responses: '),
          React.createElement('div', { className: 'inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm ml-2' }, s.responseCount||0)
        ),
        React.createElement('div', { className: 'mb-2' },
          React.createElement('span', { className: 'text-gray-600' }, 'Owners: '),
          s.Owners?.results?.length
            ? React.createElement('div', { className: 'inline-flex flex-wrap gap-2 ml-2' },
                s.Owners.results.map(o=>React.createElement('div',{key:o.Id,className:'bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm'},o.Title))
              )
            : React.createElement('span', { className: 'text-gray-500 text-sm ml-2' }, 'None')
        )
      ),
      React.createElement('div', { className: 'p-4 border-t bg-gray-50 flex gap-2 flex-wrap' },
        React.createElement('button', { className: 'bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 flex items-center text-xs md:text-sm',
          onClick:()=>window.open('/builder.aspx?surveyId='+s.FormGUID,'_blank')
        }, React.createElement('i',{className:'fas fa-edit mr-2'}),'Edit Form'),
        React.createElement('button', { className: 'bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 flex items-center text-xs md:text-sm',
          onClick:()=>window.open('/response.aspx?surveyId='+s.FormGUID,'_blank')
        }, React.createElement('i',{className:'fas fa-chart-bar mr-2'}),'Report'),
        React.createElement('button', { className: 'bg-purple-500 text-white px-3 py-1 rounded hover:bg-purple-600 flex items-center text-xs md:text-sm',
          onClick:this.props.onViewQR
        }, React.createElement('i',{className:'fas fa-qrcode mr-2'}),'QR'),
        React.createElement('button', { className: 'bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600 flex items-center text-xs md:text-sm',
          onClick:this.props.onEditMetadata
        }, React.createElement('i',{className:'fas fa-cog mr-2'}),'Metadata'),
        React.createElement('button', { className: 'bg-indigo-500 text-white px-3 py-1 rounded hover:bg-indigo-600 flex items-center text-xs md:text-sm',
          onClick:()=>window.open('/formfiller.aspx?surveyId='+s.FormGUID,'_blank')
        }, React.createElement('i',{className:'fas fa-pen mr-2'}),'Fill Form'),
        s.AuthorId===this.props.currentUserId && React.createElement('button', {
          className: 'bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 flex items-center text-xs md:text-sm',
          onClick:this.props.onDelete
        }, React.createElement('i',{className:'fas fa-trash mr-2'}),'Delete')
      )
    );
  }
}

// -------------------------------------------------------------------
// 11. QR MODAL – USES FormGUID
// -------------------------------------------------------------------
class QRModal extends React.Component {
  componentDidMount() {
    new QRious({
      element: document.getElementById('qr-'+this.props.survey.Id),
      value: spUrl('formfiller.aspx?surveyId='+this.props.survey.FormGUID),
      size: 200
    });
  }
  download() {
    const c = document.getElementById('qr-'+this.props.survey.Id);
    const a = document.createElement('a');
    a.href = c.toDataURL('image/png');
    a.download = this.props.survey.Title.replace(/[^a-z0-9]/gi,'_')+'_QR.png';
    a.click();
  }
  copy() {
    navigator.clipboard.writeText(spUrl('formfiller.aspx?surveyId='+this.props.survey.FormGUID))
      .then(()=>this.props.addNotification('URL copied!','success'))
      .catch(()=>this.props.addNotification('Copy failed','error'));
  }
  render() {
    return React.createElement('div', { className: 'fixed inset-0 flex items-center justify-center z-1200 bg-black/50' },
      React.createElement('div', { className: 'bg-white rounded-lg shadow-xl w-11/12 max-w-md sm:max-w-lg md:max-w-xl' },
        React.createElement('div', { className: 'flex justify-between items-center p-4 border-b bg-gray-100' },
          React.createElement('h2', { className: 'text-lg font-bold' }, 'QR Code'),
          React.createElement('button', { className: 'text-gray-600 hover:text-gray-800', onClick: this.props.onClose },
            React.createElement('i', { className: 'fas fa-times' }))
        ),
        React.createElement('div', { className: 'p-6 flex justify-center' },
          React.createElement('canvas', { id: 'qr-'+this.props.survey.Id })
        ),
        React.createElement('div', { className: 'p-4 border-t bg-gray-50 flex justify-end gap-3' },
          React.createElement('button', { className: 'bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 flex items-center',
            onClick: this.copy.bind(this) }, React.createElement('i', { className: 'fas fa-copy mr-2' }), 'Copy URL'),
          React.createElement('button', { className: 'bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 flex items-center',
            onClick: this.download.bind(this) }, React.createElement('i', { className: 'fas fa-download mr-2' }), 'Download'),
          React.createElement('button', { className: 'bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 flex items-center',
            onClick: this.props.onClose }, React.createElement('i', { className: 'fas fa-times mr-2' }), 'Close')
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
          React.createElement('h2', { className: 'text-lg font-bold' }, 'Confirm Delete'),
          React.createElement('button', { className: 'text-gray-600 hover:text-gray-800', onClick: this.props.onCancel },
            React.createElement('i', { className: 'fas fa-times' }))
        ),
        React.createElement('div', { className: 'p-6' },
          React.createElement('p', { className: 'text-gray-600' },
            `Delete "${this.props.survey.Title}"? This cannot be undone.`)
        ),
        React.createElement('div', { className: 'p-4 border-t bg-gray-50 flex justify-end gap-3' },
          React.createElement('button', { className: 'bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 flex items-center',
            onClick: this.props.onConfirm }, React.createElement('i', { className: 'fas fa-check mr-2' }), 'Confirm'),
          React.createElement('button', { className: 'bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 flex items-center',
            onClick: this.props.onCancel }, React.createElement('i', { className: 'fas fa-times mr-2' }), 'Cancel')
        )
      )
    );
  }
}

// -------------------------------------------------------------------
// 13. PEOPLE PICKER SEARCH
// -------------------------------------------------------------------
function searchPeople(query, callback) {
  getDigest().then(digest => {
    const payload = {
      queryParams: {
        __metadata: { type: 'SP.UI.ApplicationPages.ClientPeoplePickerQueryParameters' },
        AllowEmailAddresses: true,
        AllowMultipleEntities: false,
        MaximumEntitySuggestions: 50,
        PrincipalSource: 15,
        PrincipalType: 1,
        QueryString: query
      }
    };
    $.ajax({
      url: spUrl('/_api/SP.UI.ApplicationPages.ClientPeoplePickerWebServiceInterface.clientPeoplePickerSearchUser'),
      method: 'POST',
      data: JSON.stringify(payload),
      headers: {
        'Accept': 'application/json; odata=verbose',
        'Content-Type': 'application/json; odata=verbose',
        'X-RequestDigest': digest
      },
      xhrFields: { withCredentials: true }
    }).then(resp => {
      const results = JSON.parse(resp.d.ClientPeoplePickerSearchUser);
      const users = results
        .filter(r => r.EntityType === 1)
        .map(r => ({
          Title: r.DisplayText,
          Key: r.Key,
          Id: r.EntityData && r.EntityData.SPUserId ? r.EntityData.SPUserId : null
        }));
      callback(users);
    }).catch(() => callback([]));
  });
}

// -------------------------------------------------------------------
// 14. ENSURE USER
// -------------------------------------------------------------------
function ensureUser(loginName) {
  return getDigest().then(digest => {
    return $.ajax({
      url: spUrl('_api/web/ensureuser'),
      method: 'POST',
      data: JSON.stringify({ logonName: loginName }),
      headers: {
        'Accept': 'application/json; odata=verbose',
        'Content-Type': 'application/json; odata=verbose',
        'X-RequestDigest': digest
      },
      xhrFields: { withCredentials: true }
    }).then(resp => resp.d.Id);
  });
}

// -------------------------------------------------------------------
// 15. CREATE FORM MODAL – GENERATES GUID + BREAK INHERITANCE
// -------------------------------------------------------------------
class CreateFormModal extends React.Component {
  constructor(p) {
    super(p);
    this.state = {
      form: {
        Title: '',
        Owners: [{ Id: p.currentUserId, Title: p.currentUserName, Key: null }],
        StartDate: '',
        EndDate: ''
      },
      searchTerm: '',
      searchResults: [],
      loading: false,
      showDD: false,
      saving: false
    };
  }
  componentDidUpdate(prev) {
    if (prev.searchTerm !== this.state.searchTerm && this.state.searchTerm) {
      clearTimeout(this._deb); this._deb = setTimeout(() => {
        this.setState({loading:true});
        searchPeople(this.state.searchTerm, users => {
          const avail = users.filter(u => !this.state.form.Owners.some(o => o.Id === u.Id));
          this.setState({searchResults:avail, loading:false, showDD:avail.length>0});
        });
      }, 300);
    } else if (!this.state.searchTerm) this.setState({searchResults:[],showDD:false});
  }
  addOwner(u) {
    this.setState(prev => {
      const newOwners = prev.form.Owners.map(o => ({ ...o }));
      newOwners.push({ Id: u.Id || null, Title: u.Title, Key: u.Key });
      return { form: { ...prev.form, Owners: newOwners }, searchTerm: '', showDD: false };
    });
  }
  remOwner(id) {
    if (id === this.props.currentUserId) {
      this.props.addNotification('You cannot remove yourself', 'error');
      return;
    }
    this.setState(prev => ({
      form: {
        ...prev.form,
        Owners: prev.form.Owners.filter(o => o.Id !== id)
      }
    }));
  }
  save() {
    const f = this.state.form;
    if (!f.Title.trim()) return this.props.addNotification('Title required', 'error');

    this.setState({ saving: true });

    const ensurePromises = f.Owners
      .filter(o => o.Key && !o.Id)
      .map(o => ensureUser(o.Key).then(id => ({ ...o, Id: id })));

    Promise.all(ensurePromises).then(resolved => {
      const allOwners = f.Owners.map(o => resolved.find(r => r.Key === o.Key) || o);
      const ownerIds = allOwners.map(o => o.Id).filter(id => typeof id === 'number' && id > 0);

      getDigest().then(digest => {
        const payload = {
          __metadata: { type: 'SP.Data.SurveysListItem' },
          Title: f.Title,
          Status: 'Draft',
          FormGUID: generateUUID(),  // ← GENERATE GUID
          surveyData: JSON.stringify({ title: f.Title })
        };
        if (f.StartDate) payload.StartDate = new Date(f.StartDate).toISOString();
        if (f.EndDate)   payload.EndDate   = new Date(f.EndDate).toISOString();
        if (ownerIds.length > 0) payload.OwnersId = { results: ownerIds };

        $.ajax({
          url: spUrl('_api/web/lists/getbytitle(\'Surveys\')/items'),
          type: 'POST',
          data: JSON.stringify(payload),
          headers: {
            'Accept': 'application/json;odata=verbose',
            'Content-Type': 'application/json;odata=verbose',
            'X-RequestDigest': digest
          },
          xhrFields: { withCredentials: true }
        }).then(r => {
          const itemId = r.d.Id;
          const itemUrl = spUrl(`_api/web/lists/getbytitle('Surveys')/items(${itemId})`);

          // BREAK INHERITANCE FIRST
          $.ajax({
            url: itemUrl + '/breakroleinheritance(copyRoleAssignments=false)',
            method: 'POST',
            headers: { 'X-RequestDigest': digest },
            xhrFields: { withCredentials: true }
          }).then(() => {
            // NOW GRANT PERMISSIONS
            grantEditPermissionToOwners(itemId, ownerIds, [], () => {
              this.props.addNotification('Created!', 'success');
              window.open(`/builder.aspx?surveyId=${r.d.FormGUID}`, '_blank');
              setTimeout(() => this.props.loadSurveys(), 1500);
              this.props.onClose();
            }, () => this.setState({ saving: false }));
          }).catch(err => {
            console.error('Break inheritance failed:', err);
            this.props.addNotification('Permission setup failed', 'error');
            this.setState({ saving: false });
          });
        }).catch(err => {
          console.error('Create error:', err);
          this.props.addNotification('Create failed', 'error');
          this.setState({ saving: false });
        });
      });
    });
  }
  render() {
    const _ = this;
    const titleProps = (function(){
      let t; return {
        type:'text', value:_.state.form.Title,
        onChange:e=>{ clearTimeout(t); t=setTimeout(()=>_.setState(s=>({form:{...s.form,Title:e.target.value}})),50); },
        className:'w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500',
        placeholder:'Form title...'
      };
    })();
    return React.createElement('div',{className:'fixed inset-0 flex items-center justify-center z-1200 bg-black/50'},
      React.createElement('div',{className:'bg-white rounded-lg shadow-xl w-11/12 max-w-xl'},
        React.createElement('div',{className:'flex justify-between items-center p-4 border-b bg-gray-100'},
          React.createElement('h2',{className:'text-lg font-bold'},'Create Form'),
          React.createElement('button',{onClick:this.props.onClose,className:'text-gray-600'},'x')
        ),
        React.createElement('div',{className:'p-6 space-y-4 overflow-y-auto max-h-96'},
          React.createElement('div',null,
            React.createElement('label',{className:'block mb-1 text-gray-700'},'Title *'),
            React.createElement('input',titleProps)
          ),
          React.createElement('div',null,
            React.createElement('label',{className:'block mb-1 text-gray-700'},'Owners'),
            React.createElement('div',{className:'relative'},
              React.createElement('input',{
                type:'text', value:this.state.searchTerm,
                onChange:e=>this.setState({searchTerm:e.target.value}),
                placeholder:'Search users...',
                className:'w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500'
              }),
              this.state.loading && React.createElement('i',{className:'absolute top-2 right-2 fas fa-spinner fa-spin'}),
              this.state.showDD && this.state.searchResults.length>0 && React.createElement('ul',{
                className:'absolute z-10 w-full bg-white border rounded mt-1 max-h-48 overflow-y-auto shadow-lg'
              }, this.state.searchResults.map(u=>
                React.createElement('li',{key:u.Key,onClick:()=>this.addOwner(u),className:'p-2 hover:bg-gray-100 cursor-pointer border-b last:border-b-0'},u.Title)
              ))
            ),
            React.createElement('div',{className:'mt-2 flex flex-wrap gap-2'},
              this.state.form.Owners.map(o=>
                React.createElement('div',{key:o.Id||o.Key,className:'flex items-center bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm'},
                  o.Title,
                  o.Id!==this.props.currentUserId && React.createElement('button',{onClick:()=>this.remOwner(o.Id),className:'ml-2 text-red-600 hover:text-red-800'},'x')
                )
              )
            )
          ),
          React.createElement('div',null,
            React.createElement('label',{className:'block mb-1 text-gray-700'},'Start Date'),
            React.createElement('input',{type:'date',value:this.state.form.StartDate,
              onChange:e=>this.setState(s=>({form:{...s.form,StartDate:e.target.value}})),
              className:'w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500'
            })
          ),
          React.createElement('div',null,
            React.createElement('label',{className:'block mb-1 text-gray-700'},'End Date'),
            React.createElement('input',{type:'date',value:this.state.form.EndDate,
              onChange:e=>this.setState(s=>({form:{...s.form,EndDate:e.target.value}})),
              className:'w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500'
            })
          )
        ),
        React.createElement('div',{className:'flex justify-end gap-3 p-4 border-t bg-gray-50'},
          React.createElement('button',{
            className:`bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 flex items-center ${this.state.saving?'opacity-50 cursor-not-allowed':''}`,
            onClick:this.save.bind(this), disabled:this.state.saving
          }, this.state.saving ? [React.createElement('i',{className:'fas fa-spinner fa-spin mr-2',key:'s'}),'Creating...']
            : [React.createElement('i',{className:'fas fa-plus mr-2',key:'p'}),'Create']),
          React.createElement('button',{className:'bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 flex items-center',
            onClick:this.props.onClose, disabled:this.state.saving
          }, React.createElement('i',{className:'fas fa-times mr-2'}),'Cancel')
        )
      )
    );
  }
}

// -------------------------------------------------------------------
// 16. EDIT METADATA MODAL – FULL CONTROL + REMOVE PERMS
// -------------------------------------------------------------------
class EditModal extends React.Component {
  constructor(p) {
    super(p);
    const s = p.survey;
    this.state = {
      form: {
        Title: s.Title || '',
        Owners: (s.Owners?.results || []).map(o => ({ Id: o.Id, Title: o.Title, Key: null })),
        StartDate: s.StartDate ? new Date(s.StartDate).toISOString().split('T')[0] : '',
        EndDate:   s.EndDate   ? new Date(s.EndDate).toISOString().split('T')[0] : '',
        Status:    s.Status || 'Draft'
      },
      searchTerm: '',
      searchResults: [],
      loading: false,
      showDD: false,
      saving: false
    };
  }
  componentDidUpdate(prev) {
    if (prev.searchTerm !== this.state.searchTerm && this.state.searchTerm) {
      clearTimeout(this._deb); this._deb = setTimeout(() => {
        this.setState({loading:true});
        searchPeople(this.state.searchTerm, users => {
          const avail = users.filter(u => !this.state.form.Owners.some(o => o.Id === u.Id));
          this.setState({searchResults:avail, loading:false, showDD:avail.length>0});
        });
      }, 300);
    } else if (!this.state.searchTerm) this.setState({searchResults:[],showDD:false});
  }
  addOwner(u) {
    this.setState(prev => {
      const newOwners = prev.form.Owners.map(o => ({ ...o }));
      newOwners.push({ Id: u.Id || null, Title: u.Title, Key: u.Key });
      return { form: { ...prev.form, Owners: newOwners }, searchTerm: '', showDD: false };
    });
  }
  remOwner(id) {
    if (id === this.props.currentUserId) {
      this.props.addNotification('You cannot remove yourself', 'error');
      return;
    }
    this.setState(prev => ({
      form: {
        ...prev.form,
        Owners: prev.form.Owners.filter(o => o.Id !== id)
      }
    }));
  }
  save() {
    const f = this.state.form;
    if (!f.Title.trim()) return this.props.addNotification('Title required', 'error');

    const currentUserId = this.props.currentUserId;
    const isOwner = (this.props.survey.Owners?.results || []).some(o => o.Id === currentUserId);
    if (!isOwner) return this.props.addNotification('Only owners can modify owners', 'error');

    if (!f.Owners.some(o => o.Id === currentUserId)) {
      return this.props.addNotification('You cannot remove yourself from owners', 'error');
    }

    this.setState({ saving: true });

    const ensurePromises = f.Owners
      .filter(o => o.Key && !o.Id)
      .map(o => ensureUser(o.Key).then(id => ({ ...o, Id: id })));

    Promise.all(ensurePromises).then(resolved => {
      const allOwners = f.Owners.map(o => resolved.find(r => r.Key === o.Key) || o);
      const newOwnerIds = allOwners.map(o => o.Id).filter(id => typeof id === 'number' && id > 0);
      const oldOwnerIds = (this.props.survey.Owners?.results || []).map(o => o.Id);
      const removedOwnerIds = oldOwnerIds.filter(id => !newOwnerIds.includes(id));

      getDigest().then(digest => {
        const listUrl = spUrl(`_api/web/lists/getbytitle('Surveys')`);
        const itemUrl = listUrl + `/items(${this.props.survey.Id})`;

        const payload = {
          __metadata: { type: 'SP.Data.SurveysListItem' },
          Title: f.Title,
          Status: f.Status
        };
        if (f.StartDate) payload.StartDate = new Date(f.StartDate).toISOString();
        if (f.EndDate)   payload.EndDate   = new Date(f.EndDate).toISOString();
        if (newOwnerIds.length > 0) payload.OwnersId = { results: newOwnerIds };

        $.ajax({
          url: itemUrl,
          type: 'POST',
          data: JSON.stringify(payload),
          headers: {
            'Accept': 'application/json;odata=verbose',
            'Content-Type': 'application/json;odata=verbose',
            'X-HTTP-Method': 'MERGE',
            'If-Match': '*',
            'X-RequestDigest': digest
          },
          xhrFields: { withCredentials: true }
        }).then(() => {
          grantEditPermissionToOwners(this.props.survey.Id, newOwnerIds, removedOwnerIds, () => {
            this.props.addNotification('Updated!', 'success');
            setTimeout(() => this.props.loadSurveys(), 1500);
            this.props.onClose();
          }, () => this.setState({ saving: false }));
        }).catch(err => {
          console.error('Save error:', err);
          this.props.addNotification('Save failed', 'error');
          this.setState({ saving: false });
        });
      });
    });
  }
  render() {
    const _ = this;
    const currentUserId = this.props.currentUserId;
    const isOwner = (this.props.survey.Owners?.results || []).some(o => o.Id === currentUserId);
    const titleProps = (function(){
      let t; return {
        type:'text', value:_.state.form.Title,
        onChange:e=>{ clearTimeout(t); t=setTimeout(()=>_.setState(s=>({form:{...s.form,Title:e.target.value}})),50); },
        className:'w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500'
      };
    })();
    return React.createElement('div',{className:'fixed inset-0 flex items-center justify-center z-1200 bg-black/50'},
      React.createElement('div',{className:'bg-white rounded-lg shadow-xl w-11/12 max-w-xl'},
        React.createElement('div',{className:'flex justify-between items-center p-4 border-b bg-gray-100'},
          React.createElement('h2',{className:'text-lg font-bold'},'Edit Form'),
          React.createElement('button',{onClick:this.props.onClose,className:'text-gray-600'},'x')
        ),
        React.createElement('div',{className:'p-6 space-y-4 overflow-y-auto max-h-96'},
          React.createElement('div',null,
            React.createElement('label',{className:'block mb-1 text-gray-700'},'Title *'),
            React.createElement('input',titleProps)
          ),
          React.createElement('div',null,
            React.createElement('label',{className:'block mb-1 text-gray-700'},'Owners'),
            isOwner
              ? React.createElement('div',{className:'space-y-2'},
                  React.createElement('div',{className:'relative'},
                    React.createElement('input',{
                      type:'text', value:this.state.searchTerm,
                      onChange:e=>this.setState({searchTerm:e.target.value}),
                      placeholder:'Search users...',
                      className:'w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500'
                    }),
                    this.state.loading && React.createElement('i',{className:'absolute top-2 right-2 fas fa-spinner fa-spin'}),
                    this.state.showDD && this.state.searchResults.length>0 && React.createElement('ul',{
                      className:'absolute z-10 w-full bg-white border rounded mt-1 max-h-48 overflow-y-auto shadow-lg'
                    }, this.state.searchResults.map(u=>
                      React.createElement('li',{key:u.Key,onClick:()=>this.addOwner(u),className:'p-2 hover:bg-gray-100 cursor-pointer border-b last:border-b-0'},u.Title)
                    ))
                  ),
                  React.createElement('div',{className:'flex flex-wrap gap-2 mt-2'},
                    this.state.form.Owners.map(o=>
                      React.createElement('div',{key:o.Id||o.Key,className:'flex items-center bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm'},
                        o.Title,
                        o.Id!==currentUserId && React.createElement('button',{onClick:()=>this.remOwner(o.Id),className:'ml-2 text-red-600 hover:text-red-800'},'x')
                      )
                    )
                  )
                )
              : React.createElement('div',{className:'bg-gray-100 p-3 rounded text-sm text-gray-600'},
                  'Only owners can modify owners.',
                  React.createElement('div',{className:'mt-2 flex flex-wrap gap-1'},
                    this.state.form.Owners.map(o=>React.createElement('span',{className:'bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs'},o.Title))
                  )
                )
          ),
          React.createElement('div',null,
            React.createElement('label',{className:'block mb-1 text-gray-700'},'Start Date'),
            React.createElement('input',{type:'date',value:this.state.form.StartDate,
              onChange:e=>this.setState(s=>({form:{...s.form,StartDate:e.target.value}})),
              className:'w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500'
            })
          ),
          React.createElement('div',null,
            React.createElement('label',{className:'block mb-1 text-gray-700'},'End Date'),
            React.createElement('input',{type:'date',value:this.state.form.EndDate,
              onChange:e=>this.setState(s=>({form:{...s.form,EndDate:e.target.value}})),
              className:'w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500'
            })
          ),
          React.createElement('div',null,
            React.createElement('label',{className:'block mb-1 text-gray-700'},'Status'),
            React.createElement('select',{
              value:this.state.form.Status,
              onChange:e=>this.setState(s=>({form:{...s.form,Status:e.target.value}})),
              className:'w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500'
            },
              React.createElement('option',{value:'Draft'},'Draft'),
              React.createElement('option',{value:'Published'},'Published')
            )
          )
        ),
        React.createElement('div',{className:'flex justify-end gap-3 p-4 border-t bg-gray-50'},
          React.createElement('button',{
            className:`bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 flex items-center ${this.state.saving?'opacity-50 cursor-not-allowed':''}`,
            onClick:this.save.bind(this), disabled:this.state.saving
          }, this.state.saving ? [React.createElement('i',{className:'fas fa-spinner fa-spin mr-2',key:'s'}),'Saving...']
            : [React.createElement('i',{className:'fas fa-save mr-2',key:'p'}),'Save']),
          React.createElement('button',{className:'bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 flex items-center',
            onClick:this.props.onClose, disabled:this.state.saving
          }, React.createElement('i',{className:'fas fa-times mr-2'}),'Cancel')
        )
      )
    );
  }
}

// -------------------------------------------------------------------
// 17. MAIN APP – LOADS FormGUID
// -------------------------------------------------------------------
class App extends React.Component {
  constructor(p) {
    super(p);
    this.state = {
      surveys: [], filtered: [], userId: null, userName: null,
      notifs: [], editing: null, qr: null, deleting: null, creating: false, sidebar: false
    };
    this.load = this.load.bind(this);
    this.addNotif = this.addNotif.bind(this);
    this.del = this.del.bind(this);
    this.filter = this.filter.bind(this);
  }
  componentDidMount() {
    ExecuteOrDelayUntilScriptLoaded(() => {
      $.ajax({
        url: spUrl('_api/web/currentuser'),
        headers: { Accept: 'application/json;odata=verbose' },
        xhrFields: { withCredentials: true }
      }).done(d => this.setState({ userId: d.d.Id, userName: d.d.Title }, this.load));
    }, 'sp.js');
  }
  load() {
    $.ajax({
      url: spUrl('_api/web/lists/getbytitle(\'Surveys\')/items?$select=Id,Title,Owners/Id,Owners/Title,StartDate,EndDate,Status,AuthorId,Created,FormGUID&$expand=Owners'),
      headers: { Accept: 'application/json;odata=verbose' },
      xhrFields: { withCredentials: true }
    }).done(data => {
      const allSurveys = data.d.results.sort((a, b) => new Date(b.Created) - new Date(a.Created));
      const userId = this.state.userId;

      const visibleSurveys = allSurveys.filter(s =>
        s.AuthorId === userId ||
        (s.Owners?.results || []).some(o => o.Id === userId)
      );

      Promise.all(visibleSurveys.map(s =>
        $.ajax({
          url: spUrl(`_api/web/lists/getbytitle('SurveyResponses')/items?$filter=SurveyID/Id eq ${s.Id}`),
          headers: { Accept: 'application/json;odata=verbose' },
          xhrFields: { withCredentials: true }
        }).then(r => { s.responseCount = r.d.results.length; return s; })
          .catch(() => { s.responseCount = 0; return s; })
      )).then(surveysWithCount => {
        this.setState({ surveys: surveysWithCount, filtered: surveysWithCount });
      });
    }).fail(() => this.addNotif('Load failed', 'error'));
  }
  addNotif(msg, type = 'success') {
    const id = Date.now();
    this.setState(s => ({ notifs: s.notifs.concat([{ id, msg, type }]) }));
    setTimeout(() => this.setState(s => ({ notifs: s.notifs.filter(n => n.id !== id) })), 5000);
  }
  del(id) {
    this.setState({ deleting: null });
    getDigest().then(d => $.ajax({
      url: spUrl(`_api/web/lists/getbytitle('Surveys')/items(${id})`),
      type: 'POST',
      headers: { 'X-HTTP-Method': 'DELETE', 'If-Match': '*', 'X-RequestDigest': d },
      xhrFields: { withCredentials: true }
    }).done(() => { this.addNotif('Deleted'); this.load(); })
      .fail(() => this.addNotif('Delete failed', 'error')));
  }
  filter(term, status) {
    let list = [...this.state.surveys];
    if (term) list = list.filter(s => s.Title.toLowerCase().includes(term.toLowerCase()));
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (status !== 'All') {
      list = list.filter(s => {
        const st = s.StartDate ? new Date(s.StartDate) : null;
        const en = s.EndDate ? new Date(s.EndDate) : null;
        switch (status) {
          case 'Published': return s.Status === 'Published';
          case 'Draft': return s.Status === 'Draft';
          case 'Upcoming': return st && st > today;
          case 'Running': return st && en && st <= today && en >= today && s.Status === 'Published';
          default: return true;
        }
      });
    }
    this.setState({ filtered: list });
  }
  render() {
    const _ = this;
    const cards = this.state.filtered.map(s =>
      React.createElement(SurveyCard, {
        key: s.Id, survey: s, currentUserId: this.state.userId,
        onViewQR: () => this.setState({ qr: s }),
        onEditMetadata: () => this.setState({ editing: s }),
        onDelete: () => this.setState({ deleting: s }),
        addNotification: this.addNotif.bind(this)
      })
    );
    return React.createElement('div', { className: 'min-h-screen bg-gray-100' },
      React.createElement(TopNav, { currentUserName: this.state.userName, onToggleSidebar: () => this.setState(p => ({ sidebar: !p.sidebar })), isSidebarOpen: this.state.sidebar }),
      React.createElement('div', { className: 'flex pt-16' },
        React.createElement(SideNav, { isOpen: this.state.sidebar, onFilter: this.filter.bind(this) }),
        React.createElement('main', { className: 'flex-1 p-4' },
          React.createElement('div', { className: 'flex justify-between items-center mb-4' },
            React.createElement('h1', { className: 'text-2xl font-bold' }, 'Forms'),
            React.createElement('button', { className: 'bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 flex items-center',
              onClick: () => this.setState({ creating: true })
            }, React.createElement('i', { className: 'fas fa-plus mr-2' }), 'Create New Form')
          ),
          React.createElement('div', { className: 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-4' }, cards)
        )
      ),
      this.state.notifs.map(n => React.createElement(Notification, { key: n.id, message: n.msg, type: n.type })),
      this.state.qr && React.createElement(QRModal, { survey: this.state.qr, onClose: () => this.setState({ qr: null }), addNotification: this.addNotif.bind(this) }),
      this.state.deleting && React.createElement(DeleteModal, { survey: this.state.deleting,
        onConfirm: () => this.del(this.state.deleting.Id), onCancel: () => this.setState({ deleting: null }) }),
      this.state.creating && React.createElement(CreateFormModal, {
        currentUserId: this.state.userId, currentUserName: this.state.userName,
        addNotification: this.addNotif.bind(this), loadSurveys: this.load, onClose: () => this.setState({ creating: false })
      }),
      this.state.editing && React.createElement(EditModal, {
        survey: this.state.editing, currentUserId: this.state.userId,
        addNotification: this.addNotif.bind(this), loadSurveys: this.load, onClose: () => this.setState({ editing: null })
      })
    );
  }
}

// -------------------------------------------------------------------
// 18. RENDER – after sp.js
// -------------------------------------------------------------------
ExecuteOrDelayUntilScriptLoaded(() => {
  const root = document.getElementById('root');
  if (root) ReactDOM.render(React.createElement(App), root);
}, 'sp.js');