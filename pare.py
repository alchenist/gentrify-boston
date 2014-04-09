#! /usr/bin/env python

'''
Pare down the data dump into manageable format by binning value data by 
precinct. Outputs averages and medians for each year for each precinct
in csv format to be merged with the main shapefile via mbostock's 
topojson binary.
'''

import sys
import json
import csv
import dbf
from collections import defaultdict

def median(list):
    length = len(list)
    if length == 0: return None
    if length == 1: return list[0]
    a = list[length//2 - 1]
    b = list[length//2]
    return (a + b)/2 if length % 2 == 0 else b

def main():
    parcels = dbf.Table(sys.argv[1])
    parcels.open()
    
    newdata = defaultdict(lambda: defaultdict(list))
    years = set()
    alldata = defaultdict(list)
    
    with open(sys.argv[2], 'rb') as f:
        data = json.load(f)
        for record in parcels:
            if not(record.pid_long in data): continue
            datum = data[record.pid_long]
            ward_preci = ''.join(record.wpd.strip().split("-")[:2])
            for year in datum['values']:
                newdata[ward_preci][year].append(datum['values'][year]['val'])
                years.add(year)
        
    fieldnames = ['ward_preci'] + sorted(list(years))
    
    with open(sys.argv[3], 'wb') as f:
        overalldict = {"ward_preci": "OVERALL"}
        maxdict = defaultdict(int)
        maxdict["ward_preci"] = "MAX"
        
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for ward_preci in newdata:
            if ward_preci == "": continue
            datadict = {"ward_preci": ward_preci.zfill(4)}
            for year in newdata[ward_preci]:
                values = newdata[ward_preci][year]
                alldata[year].extend(values)
                datadict[year] = sum(values)/float(len(values))
                maxdict[year] = max(maxdict[year], datadict[year])
            writer.writerow(datadict)
        
        for year in alldata:
            values = alldata[year]
            overalldict[year] = sum(values)/float(len(values))
        writer.writerow(overalldict)
        writer.writerow(maxdict)
        
        
            
    with open(sys.argv[4], 'wb') as f:
        overalldict = {"ward_preci": "OVERALL"}
        maxdict = defaultdict(int)
        maxdict["ward_preci"] = "MAX"
        
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for ward_preci in newdata:
            if ward_preci == "": continue
            datadict = {"ward_preci": ward_preci.zfill(4)}
            for year in newdata[ward_preci]:
                values = newdata[ward_preci][year]
                datadict[year] = median(sorted(values))
                maxdict[year] = max(maxdict[year], datadict[year])
            writer.writerow(datadict)
        
        for year in alldata:
            values = alldata[year]
            overalldict[year] = median(sorted(values))
        writer.writerow(overalldict)
        writer.writerow(maxdict)
        
if __name__ == "__main__":
    main()