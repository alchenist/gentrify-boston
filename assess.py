#! /usr/bin/env python

'''
Given a parcel shapefile, scrapes data for every parcel id 
and dumps it in JSON format. Data cleaning and wrangling for 
the final vis is done separately/partly manually.
'''

import sys
import dbf
import requests
from lxml import html
import json

def main():
    parcels = dbf.Table(sys.argv[1])
    parcels.open()
    data = None
    counter = 0
    
    try:
        with open(sys.argv[2], 'rb') as f:
            data = json.load(f)
    except:
        data = {}

    for record in parcels:
        pid = record.pid_long.rjust(10, '0')
        r = requests.get("http://www.cityofboston.gov/assessing/search/", params = {'pid': pid})
        counter += 1
        print counter
        t = html.fromstring(r.text)
        data_obj = {'pid': pid, 'ward': record.ward, 'parcel': record.parcel.rstrip()}
        
        # scrape assessed value data
        values = {}
        value_table = t.xpath('//*[@id="contentTable"]/tr[1]/td[2]/div/table[2]/tr/td[2]/table[2]')
        if len(value_table) == 0: continue
        for row in value_table[0]:
            if row[0].tag == "th": continue
            val = int(row[2].text.lstrip('$').translate(None, '.,'))
            values[row[0].text] = {'type': row[1].text, 'val': val}
        data_obj['values'] = values
        
        # scrape address, lot size
        meta_table = t.xpath('//*[@id="contentTable"]/tr[1]/td[2]/div/table[1]/tr[@class="mainCategoryModuleText"]')
        for row in meta_table:
            data_obj[row[0][0].text.rstrip(':')] = row[1].text
        
        data[pid] = data_obj
        
    with open(sys.argv[2], 'wb') as f:
        json.dump(data, f)
            
            
if __name__ == "__main__":
    main()