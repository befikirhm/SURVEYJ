/* ========================================
   SharePoint 2016 Forms Dashboard
   ES5 Compatible – No Transpiler Required
   Modular, Readable, Production-Ready
   ======================================== */

// CONFIG
var CONFIG = {
  LIST_NAME: 'Surveys',
  RESPONSE_LIST: 'SurveyResponses',
  ROLE_CONTRIBUTE: 1073741827,
  MAX_SEARCH_RESULTS: 10,
  SEARCH_DEBOUNCE_MS: 300
};

// UTILS: digest.js
function getDigest() {
  return $.ajax({
    url: _spPageContextInfo.webAbsoluteUrl + '/_api/contextinfo',
    method: 'POST',
    headers: { 'Accept': 'application/json; odata=verbose' },
    xhrFields: { withCredentials: true }
  }).then(function(data) {
    return data.d.GetContextWebInformation.FormDigestValue;
  });
}

// UTILS: notifications.js
function Notification(props) {
  var className = 'fixed top-4 right-4 p-4 rounded shadow-lg text-white max-w-sm z-2000';
  if (props.type === 'error') className += ' bg-red-500';
  else if (props.type === 'warning') className += ' bg-yellow-500';
  else if (props.type === 'info') className += ' bg-blue-500';
  else className += ' bg-green-500';

  return React.createElement('div', { className: className }, props.message);
}

// UTILS: API
var API = {
  getSurveys: function() {
    return $.ajax({
      url: _spPageContextInfo.webAbsoluteUrl + "/_api/web/lists/getbytitle('" + CONFIG.LIST_NAME + "')/items?" +
           "$select=Id,Title,StartDate,EndDate,Status,AuthorId,Owners/Id,Owners/Title&$expand=Owners",
      headers: { 'Accept': 'application/json; odata=verbose' },
      xhrFields: { withCredentials: true }
    }).then(function(data) { return data.d.results; });
  },

  getResponsesCount: function(surveyId) {
    return $.ajax({
      url: _spPageContextInfo.webAbsoluteUrl + "/_api/web/lists/getbytitle('" + CONFIG.RESPONSE_LIST + "')/items?" +
           "$filter=SurveyID/Id eq " + surveyId,
      headers: { 'Accept': 'application/json; odata=verbose' },
      xhrFields: { withCredentials: true }
    }).then(function(data) { return data.d.results.length; });
  },

  searchPeople: function(query) {
    if (!query || query.trim().length < 2) return Promise.resolve([]);
    return getDigest().then(function(digest) {
      return $.ajax({
        url: _spPageContextInfo.webAbsoluteUrl + '/_api/SP.UserProfiles.PeopleManager/SearchPrincipals',
        method: 'POST',
        data: JSON.stringify({ query: query.trim(), maxResults: CONFIG.MAX_SEARCH_RESULTS, source: 'UsersOnly' }),
        headers: {
          'Accept': 'application/json; odata=verbose',
          'Content-Type': 'application/json; odata=verbose',
          'X-RequestDigest': digest
        },
        xhrFields: { withCredentials: true }
      })
      .then(function(data) {
        return (data.d.SearchPrincipals || []).map(function(u) {
          return { Id: u.AccountName.split('|').pop(), Title: u.DisplayName };
        });
      })
      .catch(function() {
        // Fallback: site users
        return $.ajax({
          url: _spPageContextInfo.webAbsoluteUrl + "/_api/web/siteusers?" +
               "$filter=startswith(Title,'" + encodeURIComponent(query) + "')&$top=" + CONFIG.MAX_SEARCH_RESULTS,
          headers: { 'Accept': 'application/json; odata=verbose' },
          xhrFields: { withCredentials: true }
        }).then(function(data) {
          return data.d.results
            .filter(function(u) { return u.PrincipalType === 1; })
            .map(function(u) { return { Id: u.Id, Title: u.Title }; });
        });
      });
    });
  }
};

// COMPONENTS: TopNav
function TopNav(props) {
  return React.createElement('nav', {
    className: 'bg-blue-600 text-white p-4 flex justify-between items-center fixed top-0 left-0 right-0 z-1000 h-16'
  },
    React.createElement('div', { className: 'flex items-center' },
      React.createElement('img', { src: '/SiteAssets/logo.png', alt: 'Logo', className: 'h-8 mr-2' }),
      React.createElement('span', { className: 'text-lg font-bold' }, 'Forms')
    ),
    React.createElement('span', null, 'Welcome, ' + props.userName)
  );
}

// COMPONENTS: SideNav
function SideNav(props) {
  var _this = this;
  this.state = { isOpen: false, search: '', status: 'All' };
  this.toggle = function() { _this.setState({ isOpen: !_this.state.isOpen }); };
  this.setSearch = function(e) { _this.setState({ search: e.target.value }); props.onFilter({ search: e.target.value, status: _this.state.status }); };
  this.setStatus = function(s) { return function() { _this.setState({ status: s }); props.onFilter({ search: _this.state.search, status: s }); }; };

  var filters = ['All', 'Published', 'Draft', 'Upcoming', 'Running'];
  return React.createElement('div', {
    className: 'bg-gray-800 text-white w-64 h-screen fixed top-0 left-0 md:static md:block z-900 ' + (this.state.isOpen ? 'block' : 'hidden md:block')
  },
    React.createElement('button', {
      className: 'md:hidden bg-blue-500 text-white px-2 py-1 rounded m-2 mt-16 z-1100 flex items-center',
      onClick: this.toggle
    },
      React.createElement('i', { className: this.state.isOpen ? 'fas fa-times mr-2' : 'fas fa-bars mr-2' }),
      this.state.isOpen ? 'Collapse' : 'Expand'
    ),
    React.createElement('div', { className: 'p-4' },
      React.createElement('input', {
        type: 'text', placeholder: 'Search forms...', value: this.state.search,
        onChange: this.setSearch,
        className: 'w-full p-2 border rounded bg-gray-700 text-white mb-4'
      }),
      React.createElement('ul', { className: 'space-y-2' },
        filters.map(function(f) {
          return React.createElement('li', { key: f },
            React.createElement('button', {
              className: 'w-full text-left p-2 rounded ' + (this.state.status === f ? 'bg-gray-700 font-semibold' : 'hover:bg-gray-700'),
              onClick: this.setStatus(f)
            }, f)
          );
        }.bind(this))
      )
    )
  );
}

// COMPONENTS: SurveyCard
function SurveyCard(props) {
  var s = props.survey;
  var start = s.StartDate ? new Date(s.StartDate).toLocaleDateString() : 'N/A';
  var end = s.EndDate ? new Date(s.EndDate).toLocaleDateString() : 'N/A';

  return React.createElement('div', { className: 'bg-white rounded shadow-md hover:shadow-lg flex flex-col' },
    React.createElement('div', { className: 'p-4 border-b bg-gray-50' },
      React.createElement('h3', { className: 'text-lg font-semibold truncate', title: s.Title }, s.Title)
    ),
    React.createElement('div', { className: 'p-4 flex-grow' },
      React.createElement('p', null, 'Status: ', React.createElement('span', { className: s.Status === 'Published' ? 'text-green-600' : 'text-gray-600' }, s.Status || 'Draft')),
      React.createElement('p', null, 'Date: ' + start + ' - ' + end),
      React.createElement('p', null, 'Responses: ', React.createElement('span', { className: 'bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm ml-2' }, s.responseCount || 0)),
      React.createElement('div', { className: 'mt-2' },
        React.createElement('span', null, 'Owners: '),
        s.Owners && s.Owners.results && s.Owners.results.length
          ? React.createElement('div', { className: 'inline-flex flex-wrap gap-1 ml-1' },
              s.Owners.results.map(function(o) {
                return React.createElement('span', { key: o.Id, className: 'bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs' }, o.Title);
              })
            )
          : React.createElement('span', { className: 'text-gray-500 text-sm' }, 'None')
      )
    ),
    React.createElement('div', { className: 'p-4 border-t bg-gray-50 flex flex-wrap gap-2' },
      React.createElement('button', { onClick: function() { window.open('/builder.aspx?surveyId=' + s.Id, '_blank'); }, className: 'bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 flex items-center text-sm' },
        React.createElement('i', { className: 'fas fa-edit mr-1' }), 'Edit'
      ),
      React.createElement('button', { onClick: function() { window.open('/response.aspx?surveyId=' + s.Id, '_blank'); }, className: 'bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 flex items-center text-sm' },
        React.createElement('i', { className: 'fas fa-chart-bar mr-1' }), 'Report'
      ),
      React.createElement('button', { onClick: props.onQR, className: 'bg-purple-500 text-white px-3 py-1 rounded hover:bg-purple-600 flex items-center text-sm' },
        React.createElement('i', { className: 'fas fa-qrcode mr-1' }), 'QR'
      ),
      React.createElement('button', { onClick: props.onEdit, className: 'bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600 flex items-center text-sm' },
        React.createElement('i', { className: 'fas fa-cog mr-1' }), 'Metadata'
      ),
      React.createElement('button', { onClick: function() { window.open('/formfiller.aspx?surveyId=' + s.Id, '_blank'); }, className: 'bg-indigo-500 text-white px-3 py-1 rounded hover:bg-indigo-600 flex items-center text-sm' },
        React.createElement('i', { className: 'fas fa-pen mr-1' }), 'Fill'
      ),
      s.AuthorId === props.currentUserId && React.createElement('button', { onClick: props.onDelete, className: 'bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 flex items-center text-sm' },
        React.createElement('i', { className: 'fas fa-trash mr-1' }), 'Delete'
      )
    )
  );
}

// COMPONENTS: QRModal
function QRModal(props) {
  React.useEffect(function() {
    new QRious({
      element: document.getElementById('qr-' + props.survey.Id),
      value: _spPageContextInfo.webAbsoluteUrl + '/formfiller.aspx?surveyId=' + props.survey.Id,
      size: 200
    });
  }, [props.survey.Id]);

  var download = function() {
    var canvas = document.getElementById('qr-' + props.survey.Id);
    var link = document.createElement('a');
    link.href = canvas.toDataURL();
    link.download = props.survey.Title.replace(/[^a-z0-9]/gi, '_') + '_QR.png';
    link.click();
  };

  var copyUrl = function() {
    navigator.clipboard.writeText(_spPageContextInfo.webAbsoluteUrl + '/formfiller.aspx?surveyId=' + props.survey.Id)
      .then(function() { props.addNotification('URL copied!', 'success'); })
      .catch(function() { props.addNotification('Copy failed.', 'error'); });
  };

  return React.createElement('div', { className: 'fixed inset-0 bg-black/50 flex items-center justify-center z-1200' },
    React.createElement('div', { className: 'bg-white rounded-lg shadow-xl w-full max-w-md' },
      React.createElement('div', { className: 'flex justify-between p-4 border-b' },
        React.createElement('h2', { className: 'text-lg font-bold' }, 'QR Code'),
        React.createElement('button', { onClick: props.onClose, className: 'text-gray-600' }, React.createElement('i', { className: 'fas fa-times' }))
      ),
      React.createElement('div', { className: 'p-6 flex justify-center' },
        React.createElement('canvas', { id: 'qr-' + props.survey.Id })
      ),
      React.createElement('div', { className: 'p-4 border-t flex justify-end gap-2' },
        React.createElement('button', { onClick: copyUrl, className: 'bg-cyan-500 text-white px-3 py-1 rounded hover:bg-cyan-600 flex items-center text-sm' },
          React.createElement('i', { className: 'fas fa-copy mr-1' }), 'Copy URL'
        ),
        React.createElement('button', { onClick: download, className: 'bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 flex items-center text-sm' },
          React.createElement('i', { className: 'fas fa-download mr-1' }), 'Download'
        ),
        React.createElement('button', { onClick: props.onClose, className: 'bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 flex items-center text-sm' },
          React.createElement('i', { className: 'fas fa-times mr-1' }), 'Close'
        )
      )
    )
  );
}

// MAIN: App
function App() {
  var _this = this;
  this.state = {
    surveys: [], filtered: [], user: { id: null, name: '' },
    notifications: [], modals: { create: false, edit: null, qr: null, delete: null }
  };

  this.addNotification = function(msg, type) {
    var id = Date.now();
    _this.setState({ notifications: _this.state.notifications.concat([{ id: id, message: msg, type: type }]) });
    setTimeout(function() {
      _this.setState({ notifications: _this.state.notifications.filter(function(n) { return n.id !== id; }) });
    }, 5000);
  };

  this.loadSurveys = function() {
    API.getSurveys().then(function(items) {
      var promises = items.map(function(s) {
        return API.getResponsesCount(s.Id).then(function(c) { s.responseCount = c; return s; });
      });
      Promise.all(promises).then(function(updated) {
        _this.setState({ surveys: updated, filtered: updated });
      });
    });
  };

  React.useEffect(function() {
    $.ajax({
      url: _spPageContextInfo.webAbsoluteUrl + '/_api/web/currentuser',
      headers: { 'Accept': 'application/json; odata=verbose' },
      xhrFields: { withCredentials: true }
    }).done(function(data) {
      _this.setState({ user: { id: data.d.Id, name: data.d.Title } });
    });
    _this.loadSurveys();
  }, []);

  return React.createElement('div', { className: 'min-h-screen bg-gray-100' },
    React.createElement(TopNav, { userName: _this.state.user.name }),
    React.createElement('div', { className: 'flex pt-16 md:pt-0' },
      React.createElement(SideNav, { onFilter: function(f) {
        var filtered = _this.state.surveys;
        if (f.searchTerm) filtered = filtered.filter(function(s) { return s.Title.toLowerCase().includes(f.searchTerm.toLowerCase()); });
        if (f.status !== 'All') filtered = filtered.filter(function(s) { return s.Status === f.status; });
        _this.setState({ filtered: filtered });
      }}),
      React.createElement('main', { className: 'flex-1 p-4' },
        React.createElement('div', { className: 'flex justify-between mb-4' },
          React.createElement('h1', { className: 'text-2xl font-bold' }, 'Forms'),
          React.createElement('button', {
            onClick: function() { _this.setState({ modals: Object.assign({}, _this.state.modals, { create: true }) }); },
            className: 'bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 flex items-center'
          }, React.createElement('i', { className: 'fas fa-plus mr-2' }), 'Create New Form')
        ),
        React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' },
          _this.state.filtered.map(function(s) {
            return React.createElement(SurveyCard, {
              key: s.Id, survey: s, currentUserId: _this.state.user.id,
              onEdit: function() { _this.setState({ modals: Object.assign({}, _this.state.modals, { edit: s }) }); },
              onQR: function() { _this.setState({ modals: Object.assign({}, _this.state.modals, { qr: s }) }); },
              onDelete: function() { _this.setState({ modals: Object.assign({}, _this.state.modals, { delete: s }) }); },
              addNotification: _this.addNotification
            });
          })
        )
      )
    ),
    _this.state.notifications.map(function(n) { return React.createElement(Notification, { key: n.id, message: n.message, type: n.type }); }),
    _this.state.modals.qr && React.createElement(QRModal, {
      survey: _this.state.modals.qr,
      onClose: function() { _this.setState({ modals: Object.assign({}, _this.state.modals, { qr: null }) }); },
      addNotification: _this.addNotification
    })
  );
}

// RENDER
ReactDOM.render(React.createElement(App), document.getElementById('root'));