"""Against a disposable/local StockFlow database. Creates records prefixed AT; never deletes existing data.
Run: STOCKFLOW_TEST_PASSWORD=<seed password> python tests/acceptance.py
Uses only Python's standard library. The API must already be running.
"""
import concurrent.futures, http.cookiejar, json, os, time, unittest, urllib.request, urllib.error
BASE=os.getenv('STOCKFLOW_API','http://127.0.0.1:5088')+'/api'
PASSWORD=os.environ['STOCKFLOW_TEST_PASSWORD']

class Client:
    def __init__(self,role=None,cookie=None):
        self.jar=http.cookiejar.CookieJar()
        self.opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))
        self.cookie=cookie
        if role:
            code,body=self.call('POST','/auth/login',{'email':role+'@stockflow.local','password':PASSWORD})
            assert code==200,(code,body)
    def call(self,method,path,body=None,csrf=True):
        headers={'Content-Type':'application/json'}
        if csrf: headers['X-StockFlow']='1'
        if self.cookie: headers['Cookie']=self.cookie
        req=urllib.request.Request(BASE+path,data=json.dumps(body).encode() if body is not None else None,method=method,headers=headers)
        try: response=self.opener.open(req,timeout=20)
        except urllib.error.HTTPError as e: response=e
        raw=response.read()
        return response.status,json.loads(raw) if raw else None
    def fork(self): return Client(cookie='; '.join(c.name+'='+c.value for c in self.jar))

class Acceptance(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.admin=Client('admin');cls.sales=Client('sales');cls.inventory=Client('inventory')
        cls.tag='AT'+str(int(time.time()*1000))
        def create(path,body):
            status,result=cls.admin.call('POST',path,body);assert status==201,(status,result);return result['id']
        cls.category=create('/categories',{'name':cls.tag})
        cls.supplier=create('/suppliers',{'name':cls.tag+' supplier'})
        cls.customer=create('/customers',{'name':cls.tag+' customer'})
        cls.product=create('/products',{'name':cls.tag+' product','sku':cls.tag,'categoryId':cls.category,'supplierId':cls.supplier,'price':125.5,'reorderLevel':2})
    def stock(self,p=None):
        status,body=self.admin.call('GET','/products/'+str(p or self.product));self.assertEqual(200,status);return body['stock']
    def order(self,qty=1,items=None):
        status,body=self.sales.call('POST','/orders',{'customerId':self.customer,'items':items or [{'productId':self.product,'quantity':qty}]});self.assertEqual(201,status,body);return body['id']
    def test_01_permissions_and_csrf(self):
        self.assertEqual(401,Client().call('GET','/products')[0])
        self.assertEqual(403,self.sales.call('POST',f'/inventory/{self.product}/adjust',{'delta':2,'reason':'Unauthorized test'})[0])
        self.assertEqual(403,self.inventory.call('POST','/orders',{'customerId':self.customer,'items':[{'productId':self.product,'quantity':1}]})[0])
        self.assertEqual(403,self.sales.call('GET','/users')[0])
        self.assertEqual(400,self.admin.call('POST','/categories',{'name':'Missing header'},csrf=False)[0])
    def test_02_validation_and_uniqueness(self):
        self.assertEqual(400,self.admin.call('POST','/categories',{'name':' a '})[0])
        self.assertEqual(400,self.admin.call('POST','/products',{'name':'Fractional price','sku':self.tag+'-BAD','categoryId':self.category,'supplierId':self.supplier,'price':1.234,'reorderLevel':0})[0])
        self.assertEqual(400,self.admin.call('POST','/products',{'name':'','sku':'!','price':-1})[0])
        self.assertEqual(400,self.sales.call('POST','/orders',{'customerId':self.customer,'items':[{'productId':self.product,'quantity':-2}]})[0])
        self.assertEqual(400,self.sales.call('POST','/orders',{'customerId':self.customer,'items':[{'productId':self.product,'quantity':1}]*2})[0])
        self.assertEqual(409,self.admin.call('POST','/products',{'name':'Duplicate','sku':self.tag.lower(),'categoryId':self.category,'supplierId':self.supplier,'price':1,'reorderLevel':0})[0])
        self.assertEqual(409,self.inventory.call('POST',f'/inventory/{self.product}/adjust',{'delta':-1,'reason':'No negative stock'})[0])
    def test_03_draft_edit_delete(self):
        order=self.order(2)
        self.assertEqual(0,self.stock())
        self.assertEqual(204,self.sales.call('PUT',f'/orders/{order}',{'customerId':self.customer,'items':[{'productId':self.product,'quantity':3}]})[0])
        self.assertEqual(376.5,self.sales.call('GET',f'/orders/{order}')[1]['total'])
        self.assertEqual(204,self.sales.call('DELETE',f'/orders/{order}')[0])
        self.assertEqual(404,self.sales.call('GET',f'/orders/{order}')[0])
    def test_04_concurrent_oversell_exactly_once_restore(self):
        self.assertEqual(204,self.inventory.call('POST',f'/inventory/{self.product}/adjust',{'delta':5,'reason':'Opening test stock'})[0])
        a,b=self.order(4),self.order(4)
        def confirm(order):return self.sales.fork().call('POST',f'/orders/{order}/confirm')[0]
        with concurrent.futures.ThreadPoolExecutor(2) as pool: statuses=list(pool.map(confirm,[a,b]))
        self.assertEqual([204,409],sorted(statuses));self.assertEqual(1,self.stock())
        winner=a if statuses[0]==204 else b
        self.assertEqual(204,confirm(winner));self.assertEqual(1,self.stock())
        # Price changes cannot rewrite an existing confirmed order.
        self.assertEqual(204,self.admin.call('PUT',f'/products/{self.product}',{'name':self.tag+' product','sku':self.tag,'categoryId':self.category,'supplierId':self.supplier,'price':999,'reorderLevel':2})[0])
        self.assertEqual(502,self.sales.call('GET',f'/orders/{winner}')[1]['total'])
        self.assertEqual(409,self.sales.call('DELETE',f'/orders/{winner}')[0])
        def cancel(_):return self.sales.fork().call('POST',f'/orders/{winner}/cancel')[0]
        with concurrent.futures.ThreadPoolExecutor(4) as pool: self.assertEqual([204]*4,list(pool.map(cancel,range(4))))
        self.assertEqual(5,self.stock());self.assertEqual(409,confirm(winner))
        movements=self.inventory.call('GET',f'/inventory/movements?productId={self.product}')[1]
        self.assertEqual(1,len([m for m in movements if m['salesOrderId']==winner and m['delta']==-4]))
        self.assertEqual(1,len([m for m in movements if m['salesOrderId']==winner and m['delta']==4]))
    def test_05_multi_line_rollback(self):
        status,created=self.admin.call('POST','/products',{'name':self.tag+' empty','sku':self.tag+'-EMPTY','categoryId':self.category,'supplierId':self.supplier,'price':10,'reorderLevel':0});self.assertEqual(201,status)
        order=self.order(items=[{'productId':self.product,'quantity':2},{'productId':created['id'],'quantity':1}]);before=self.stock()
        self.assertEqual(409,self.sales.call('POST',f'/orders/{order}/confirm')[0]);self.assertEqual(before,self.stock());self.assertEqual('Draft',self.sales.call('GET',f'/orders/{order}')[1]['status'])
        self.assertEqual([],self.inventory.call('GET',f'/inventory/movements?productId={created["id"]}')[1])
    def test_06_directory_crud_and_archive(self):
        self.assertEqual(204,self.admin.call('PUT',f'/customers/{self.customer}',{'name':self.tag+' renamed','email':'customer@example.com','phone':'123'})[0])
        self.assertEqual(204,self.admin.call('PUT',f'/suppliers/{self.supplier}',{'name':self.tag+' renamed'})[0])
        self.assertEqual(204,self.admin.call('PUT',f'/categories/{self.category}',{'name':self.tag+' renamed'})[0])
        self.assertEqual(409,self.admin.call('DELETE',f'/categories/{self.category}')[0])
        self.assertEqual(409,self.admin.call('DELETE',f'/suppliers/{self.supplier}')[0])
        self.assertEqual(204,self.admin.call('DELETE',f'/products/{self.product}')[0])
        self.assertFalse(self.admin.call('GET',f'/products/{self.product}')[1]['active'])
        self.assertEqual(204,self.admin.call('DELETE',f'/customers/{self.customer}')[0])
        self.assertEqual(400,self.sales.call('POST','/orders',{'customerId':self.customer,'items':[{'productId':self.product,'quantity':1}]})[0])
    def test_07_employee_role_revokes_session(self):
        email=self.tag.lower()+'@example.com'
        status,body=self.admin.call('POST','/users',{'email':email,'displayName':'Acceptance employee','password':PASSWORD,'role':'Sales'});self.assertEqual(201,status,body)
        employee=Client();self.assertEqual(200,employee.call('POST','/auth/login',{'email':email,'password':PASSWORD})[0]);self.assertEqual(200,employee.call('GET','/orders')[0])
        self.assertEqual(204,self.admin.call('PUT','/users/'+body['id'],{'role':'Inventory','active':True})[0])
        self.assertEqual(401,employee.call('GET','/orders')[0])
        self.assertEqual(200,employee.call('POST','/auth/login',{'email':email,'password':PASSWORD})[0]);self.assertEqual(403,employee.call('GET','/orders')[0])
        me=self.admin.call('GET','/auth/me')[1];self.assertEqual(409,self.admin.call('PUT','/users/'+me['id'],{'role':'Sales','active':False})[0])
        self.assertEqual(204,employee.call('POST','/auth/logout')[0]);self.assertEqual(401,employee.call('GET','/products')[0])
    def test_08_currency_and_api_docs(self):
        self.assertEqual(400,self.inventory.call('GET','/currency?currency=INVALID&amount=100')[0])
        status,body=self.inventory.call('GET','/currency?currency=USD&amount=100')
        self.assertIn(status,[200,503],body)
        if status==200:
            self.assertGreater(body['rate'],0);self.assertAlmostEqual(body['rate']*100,body['converted'],places=2);self.assertTrue(body['rateDate'])
        else: self.assertIn('unavailable',body['detail'])
        self.assertEqual(200,self.admin.call('GET','/products')[0])
        with urllib.request.urlopen(BASE.replace('/api','')+'/swagger/v1/swagger.json') as r:
            paths=json.load(r)['paths'];self.assertIn('/api/orders/{id}/confirm',paths)
    def test_09_password_change_revokes_other_sessions(self):
        email=self.tag.lower()+'@example.com'
        one,two=Client(),Client()
        self.assertEqual(200,one.call('POST','/auth/login',{'email':email,'password':PASSWORD})[0])
        self.assertEqual(200,two.call('POST','/auth/login',{'email':email,'password':PASSWORD})[0])
        self.assertEqual(400,one.call('POST','/auth/password',{'currentPassword':'Wrong password','newPassword':PASSWORD+'New9!'})[0])
        self.assertEqual(204,one.call('POST','/auth/password',{'currentPassword':PASSWORD,'newPassword':PASSWORD+'New9!'})[0])
        self.assertEqual(401,one.call('GET','/products')[0]);self.assertEqual(401,two.call('GET','/products')[0])
        self.assertEqual(200,two.call('POST','/auth/login',{'email':email,'password':PASSWORD+'New9!'})[0])

if __name__=='__main__': unittest.main(verbosity=2)
