/* ========================================
   SharePoint 2016 Forms Dashboard
   React 18 + Hooks – Modern, Readable
   ======================================== */

const CONFIG = {
  LIST_NAME: 'Surveys',
  RESPONSE_LIST: 'SurveyResponses',
  ROLE_CONTRIBUTE: 1073741827,
  MAX_SEARCH_RESULTS: 10,
  SEARCH_DEBOUNCE_MS: 300,
};

const getDigest = () => $.ajax({
  url: _spPageContextInfo.webAbsoluteUrl + '/_api/contextinfo',
  method: 'POST',
  headers: { 'Accept': 'application/json; odata=verbose' },
  xhrFields: { withCredentials: true },
}).then(data => data.d.GetContextWebInformation.FormDigestValue);

const useNotifications = () => {
  const [notifications, setNotifications] = React.useState([]);

  const add = (message, type = 'success') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 5000);
  };

  return { notifications, add };
};

const API = {
  getSurveys: () => $.ajax({
    url: _spPageContextInfo.webAbsoluteUrl + `/_api/web/lists/getbytitle('${CONFIG.LIST_NAME}')/items?$select=Id,Title,StartDate,EndDate,Status,AuthorId,Owners/Id,Owners/Title&$expand=Owners`,
    headers: { 'Accept': 'application/json; odata=verbose' },
    xhrFields: { withCredentials: true },
  }).then(data => data.d.results),

  getResponsesCount: (id) => $.ajax({
    url: _spPageContextInfo.webAbsoluteUrl + `/_api/web/lists/getbytitle('${CONFIG.RESPONSE_LIST}')/items?$filter=SurveyID/Id eq ${id}`,
    headers: { 'Accept': 'application/json; odata=verbose' },
    xhrFields: { withCredentials: true },
  }).then(data => data.d.results.length),

  searchSiteUsers: (query) => {
    if (!query?.trim()) return Promise.resolve([]);
    return $.ajax({
      url: _spPageContextInfo.webAbsoluteUrl + `/_api/web/siteusers?$filter=startswith(Title,'${encodeURIComponent(query)}')&$top=${CONFIG.MAX_SEARCH_RESULTS}`,
      headers: { 'Accept': 'application/json; odata=verbose' },
      xhrFields: { withCredentials: true },
    }).then(data => data.d.results
      .filter(u => u.PrincipalType === 1)
      .map(u => ({ Id: u.Id, Title: u.Title })));
  },
};

const usePeopleSearch = (currentOwners = [], currentUserId) => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [results, setResults] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [showDropdown, setShowDropdown] = React.useState(false);

  React.useEffect(() => {
    if (searchTerm.length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(() => {
      setLoading(true);
      API.searchSiteUsers(searchTerm).then(users => {
        const available = users.filter(u => !currentOwners.some(o => o.Id === u.Id));
        setResults(available);
        setShowDropdown(available.length > 0);
        setLoading(false);
      });
    }, CONFIG.SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [searchTerm, currentOwners]);

  const selectUser = (user) => {
    setSearchTerm('');
    setShowDropdown(false);
  };

  const removeUser = (userId) => {
    if (userId === currentUserId) return false;
    return true;
  };

  return { searchTerm, setSearchTerm, results, loading, showDropdown, selectUser, removeUser };
};

const TopNav = ({ userName }) => (
  <nav className="bg-blue-600 text-white p-4 flex justify-between items-center fixed top-0 left-0 right-0 z-1000 h-16">
    <div className="flex items-center">
      <img src="/SiteAssets/logo.png" alt="Logo" className="h-8 mr-2" />
      <span className="text-lg font-bold">Forms</span>
    </div>
    <span className="mr-4">Welcome, {userName}</span>
  </nav>
);

const SideNav = ({ onFilter }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState('All');

  React.useEffect(() => onFilter({ searchTerm: search, status }), [search, status]);

  const filters = ['All', 'Published', 'Draft', 'Upcoming', 'Running'];

  return (
    <div className={`bg-gray-800 text-white w-64 h-screen fixed top-0 left-0 md:static md:block z-900 ${isOpen ? 'block' : 'hidden md:block'}`}>
      <button
        className="md:hidden bg-blue-500 text-white px-2 py-1 rounded m-2 mt-16 z-1100 flex items-center"
        onClick={() => setIsOpen(!isOpen)}
      >
        <i className={isOpen ? 'fas fa-times mr-2' : 'fas fa-bars mr-2'} />
        {isOpen ? 'Collapse' : 'Expand'}
      </button>
      <div className="p-4">
        <input
          type="text"
          placeholder="Search forms..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full p-2 border rounded bg-gray-700 text-white mb-4"
        />
        <ul className="space-y-2">
          {filters.map(f => (
            <li key={f}>
              <button
                className={`w-full text-left p-2 rounded ${status === f ? 'bg-gray-700 font-semibold' : 'hover:bg-gray-700'}`}
                onClick={() => setStatus(f)}
              >
                {f}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

const SurveyCard = ({ survey, currentUserId, onEdit, onQR, onDelete, addNotification }) => {
  const start = survey.StartDate ? new Date(survey.StartDate).toLocaleDateString() : 'N/A';
  const end = survey.EndDate ? new Date(survey.EndDate).toLocaleDateString() : 'N/A';

  return (
    <div className="bg-white rounded shadow-md hover:shadow-lg flex flex-col">
      <div className="p-4 border-b bg-gray-50">
        <h3 className="text-lg font-semibold truncate" title={survey.Title}>{survey.Title}</h3>
      </div>
      <div className="p-4 flex-grow">
        <p>Status: <span className={survey.Status === 'Published' ? 'text-green-600' : 'text-gray-600'}>{survey.Status || 'Draft'}</span></p>
        <p>Date: {start} - {end}</p>
        <p>Responses: <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm ml-2">{survey.responseCount || 0}</span></p>
        <div className="mt-2">
          <span>Owners: </span>
          {survey.Owners?.results?.length ? (
            <div className="inline-flex flex-wrap gap-1 ml-1">
              {survey.Owners.results.map(o => (
                <span key={o.Id} className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">{o.Title}</span>
              ))}
            </div>
          ) : <span className="text-gray-500 text-sm">None</span>}
        </div>
      </div>
      <div className="p-4 border-t bg-gray-50 flex flex-wrap gap-2">
        <button onClick={() => window.open(`/builder.aspx?surveyId=${survey.Id}`, '_blank')} className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 flex items-center text-sm">
          <i className="fas fa-edit mr-1" />Edit
        </button>
        <button onClick={() => window.open(`/response.aspx?surveyId=${survey.Id}`, '_blank')} className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 flex items-center text-sm">
          <i className="fas fa-chart-bar mr-1" />Report
        </button>
        <button onClick={onQR} className="bg-purple-500 text-white px-3 py-1 rounded hover:bg-purple-600 flex items-center text-sm">
          <i className="fas fa-qrcode mr-1" />QR
        </button>
        <button onClick={onEdit} className="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600 flex items-center text-sm">
          <i className="fas fa-cog mr-1" />Metadata
        </button>
        <button onClick={() => window.open(`/formfiller.aspx?surveyId=${survey.Id}`, '_blank')} className="bg-indigo-500 text-white px-3 py-1 rounded hover:bg-indigo-600 flex items-center text-sm">
          <i className="fas fa-pen mr-1" />Fill
        </button>
        {survey.AuthorId === currentUserId && (
          <button onClick={onDelete} className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 flex items-center text-sm">
            <i className="fas fa-trash mr-1" />Delete
          </button>
        )}
      </div>
    </div>
  );
};

const QRModal = ({ survey, onClose, addNotification }) => {
  React.useEffect(() => {
    new QRious({
      element: document.getElementById(`qr-${survey.Id}`),
      value: `${_spPageContextInfo.webAbsoluteUrl}/formfiller.aspx?surveyId=${survey.Id}`,
      size: 200,
    });
  }, [survey.Id]);

  const download = () => {
    const canvas = document.getElementById(`qr-${survey.Id}`);
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `${survey.Title.replace(/[^a-z0-9]/gi, '_')}_QR.png`;
    link.click();
  };

  const copyUrl = () => {
    const url = `${_spPageContextInfo.webAbsoluteUrl}/formfiller.aspx?surveyId=${survey.Id}`;
    navigator.clipboard.writeText(url).then(() => {
      addNotification('URL copied to clipboard!', 'success');
    }).catch(() => {
      addNotification('Failed to copy URL.', 'error');
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-1200">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex justify-between items-center p-4 border-b bg-gray-50">
          <h2 className="text-lg font-bold">QR Code</h2>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-800">
            <i className="fas fa-times" />
          </button>
        </div>
        <div className="p-6 flex justify-center">
          <canvas id={`qr-${survey.Id}`} className="border rounded" />
        </div>
        <div className="p-4 border-t bg-gray-50 flex justify-end gap-2">
          <button onClick={copyUrl} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
            <i className="fas fa-copy mr-2" />Copy URL
          </button>
          <button onClick={download} className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">
            <i className="fas fa-download mr-2" />Download
          </button>
          <button onClick={onClose} className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">
            <i className="fas fa-times mr-2" />Close
          </button>
        </div>
      </div>
    </div>
  );
};

const DeleteModal = ({ survey, onConfirm, onCancel }) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-1200">
    <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
      <div className="flex justify-between items-center p-4 border-b bg-gray-50">
        <h2 className="text-lg font-bold">Confirm Delete</h2>
        <button onClick={onCancel} className="text-gray-600 hover:text-gray-800">
          <i className="fas fa-times" />
        </button>
      </div>
      <div className="p-6">
        <p>Are you sure you want to delete "<strong>{survey.Title}</strong>"? This action cannot be undone.</p>
      </div>
      <div className="p-4 border-t bg-gray-50 flex justify-end gap-2">
        <button onClick={onConfirm} className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">
          <i className="fas fa-check mr-2" />Confirm
        </button>
        <button onClick={onCancel} className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">
          <i className="fas fa-times mr-2" />Cancel
        </button>
      </div>
    </div>
  </div>
);

// EditModal with site users search
const EditModal = ({ survey, currentUserId, onClose, addNotification, loadSurveys }) => {
  const [form, setForm] = React.useState({
    Owners: survey.Owners?.results?.map(o => ({ Id: o.Id, Title: o.Title })) || [],
    StartDate: survey.StartDate ? new Date(survey.StartDate).toISOString().split('T')[0] : '',
    EndDate: survey.EndDate ? new Date(survey.EndDate).toISOString().split('T')[0] : '',
    Status: survey.Status || 'Draft',
  });

  const { searchTerm, setSearchTerm, results, loading, showDropdown, selectUser, removeUser } =
    usePeopleSearch(form.Owners, currentUserId);

  const handleSave = () => {
    if (form.StartDate && form.EndDate && new Date(form.EndDate) <= new Date(form.StartDate)) {
      addNotification('End Date must be after Start Date.', 'error');
      return;
    }
    if (!form.Owners.some(o => o.Id === currentUserId)) {
      addNotification('You must remain an owner.', 'error');
      return;
    }

    getDigest().then(digest => {
      const payload = {
        '__metadata': { type: 'SP.Data.SurveysListItem' },
        OwnersId: { results: form.Owners.map(o => o.Id) },
        Status: form.Status,
      };
      if (form.StartDate) payload.StartDate = new Date(form.StartDate).toISOString();
      if (form.EndDate) payload.EndDate = new Date(form.EndDate).toISOString();

      $.ajax({
        url: _spPageContextInfo.webAbsoluteUrl + `/_api/web/lists/getbytitle('${CONFIG.LIST_NAME}')/items(${survey.Id})`,
        type: 'POST',
        data: JSON.stringify(payload),
        headers: {
          'X-HTTP-Method': 'MERGE',
          'If-Match': '*',
          'X-RequestDigest': digest,
          'Content-Type': 'application/json; odata=verbose',
        },
        xhrFields: { withCredentials: true },
      }).then(() => {
        addNotification('Updated successfully!');
        loadSurveys();
        onClose();
      }).fail(err => {
        console.error('Update failed:', err);
        addNotification('Failed to update: ' + (err.responseText || err.message), 'error');
      });
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-1200">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-xl">
        <div className="flex justify-between items-center p-4 border-b bg-gray-50">
          <h2 className="text-lg font-bold">Edit Metadata</h2>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-800">
            <i className="fas fa-times" />
          </button>
        </div>
        <div className="p-6 max-h-96 overflow-y-auto">
          <div className="space-y-4">
            <div>
              <label className="block mb-1 text-gray-700">Owners</label>
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search site users..."
                  className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {loading && <div className="absolute top-2 right-2"><i className="fas fa-spinner fa-spin" /></div>}
                {showDropdown && results.length > 0 && (
                  <ul className="absolute z-10 w-full bg-white border rounded mt-1 max-h-48 overflow-y-auto shadow-lg">
                    {results.map(user => (
                      <li
                        key={user.Id}
                        onClick={() => selectUser(user)}
                        className="p-2 hover:bg-gray-100 cursor-pointer border-b last:border-b-0"
                      >
                        {user.Title}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {form.Owners.length === 0 ? (
                  <p className="text-gray-500 text-sm">No owners selected</p>
                ) : (
                  form.Owners.map(user => (
                    <div key={user.Id} className="flex items-center bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm">
                      <span>{user.Title}</span>
                      {removeUser(user.Id) && (
                        <button
                          onClick={() => removeUser(user.Id) && setForm({ ...form, Owners: form.Owners.filter(o => o.Id !== user.Id) })}
                          className="ml-2 text-red-600 hover:text-red-800 font-bold"
                        >
                          <i className="fas fa-times" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
            {/* StartDate, EndDate, Status fields */}
            <div>
              <label className="block mb-1 text-gray-700">Start Date</label>
              <input
                type="date"
                value={form.StartDate}
                onChange={e => setForm({ ...form, StartDate: e.target.value })}
                className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block mb-1 text-gray-700">End Date</label>
              <input
                type="date"
                value={form.EndDate}
                onChange={e => setForm({ ...form, EndDate: e.target.value })}
                className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block mb-1 text-gray-700">Status</label>
              <select
                value={form.Status}
                onChange={e => setForm({ ...form, Status: e.target.value })}
                className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Published">Published</option>
                <option value="Draft">Draft</option>
              </select>
            </div>
          </div>
        </div>
        <div className="p-4 border-t bg-gray-50 flex justify-end gap-2">
          <button onClick={handleSave} disabled={loading} className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">
            Save
          </button>
          <button onClick={onClose} className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

// App component
const App = () => {
  const [surveys, setSurveys] = React.useState([]);
  const [filtered, setFiltered] = React.useState([]);
  const [user, setUser] = React.useState({ id: null, name: '' });
  const { notifications, add: addNotification } = useNotifications();
  const [modals, setModals] = React.useState({ create: false, edit: null, qr: null, delete: null });

  React.useEffect(() => {
    $.ajax({
      url: _spPageContextInfo.webAbsoluteUrl + '/_api/web/currentuser',
      headers: { 'Accept': 'application/json; odata=verbose' },
      xhrFields: { withCredentials: true },
    }).done(data => setUser({ id: data.d.Id, name: data.d.Title }));
  }, []);

  const loadSurveys = React.useCallback(() => {
    API.getSurveys().then(items => {
      const promises = items.map(s => API.getResponsesCount(s.Id).then(c => ({ ...s, responseCount: c })));
      Promise.all(promises).then(setSurveys);
    });
  }, []);

  React.useEffect(() => {
    loadSurveys();
  }, [loadSurveys]);

  const filterSurveys = React.useCallback(({ searchTerm, status }) => {
    let f = surveys;
    if (searchTerm) f = f.filter(s => s.Title.toLowerCase().includes(searchTerm.toLowerCase()));
    if (status && status !== 'All') f = f.filter(s => s.Status === status);
    setFiltered(f);
  }, [surveys]);

  return (
    <div className="min-h-screen bg-gray-100">
      <TopNav userName={user.name} />
      <div className="flex pt-16 md:pt-0">
        <SideNav onFilter={filterSurveys} />
        <main className="flex-1 p-4">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold">Forms</h1>
            <button onClick={() => setModals(prev => ({ ...prev, create: true }))} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 flex items-center">
              <i className="fas fa-plus mr-2" />Create New Form
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {filtered.map(survey => (
              <SurveyCard
                key={survey.Id}
                survey={survey}
                currentUserId={user.id}
                onEdit={() => setModals(prev => ({ ...prev, edit: survey }))}
                onQR={() => setModals(prev => ({ ...prev, qr: survey }))}
                onDelete={() => setModals(prev => ({ ...prev, delete: survey }))}
                addNotification={addNotification}
              />
            ))}
          </div>
        </main>
      </div>
      {notifications.map(n => <Notification key={n.id} message={n.message} type={n.type} />)}
      {modals.edit && <EditModal survey={modals.edit} currentUserId={user.id} onClose={() => setModals(prev => ({ ...prev, edit: null }))} addNotification={addNotification} loadSurveys={loadSurveys} />}
      {modals.qr && <QRModal survey={modals.qr} onClose={() => setModals(prev => ({ ...prev, qr: null }))} addNotification={addNotification} />}
      {modals.delete && <DeleteModal survey={modals.delete} onConfirm={() => {/* delete logic */}} onCancel={() => setModals(prev => ({ ...prev, delete: null }))} />}
    </div>
  );
};

// Render
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);