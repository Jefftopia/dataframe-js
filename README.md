# dataframe-js

![](https://travis-ci.org/Gmousse/dataframe-js.svg?branch=develop)
![](https://coveralls.io/repos/github/Gmousse/dataframe-js/badge.svg?branch=master)

**Official Website**: <https://gmousse.gitbooks.io/dataframe-js/>

**Current Version**: [1.1.5](https://github.com/Gmousse/dataframe-js/blob/master/CHANGELOG.md)

**Compatibility**:
- Browsers (IE > 8, Edge, Firefox, Chrome...)
- NodeJS 0.10, 0.11, 0.12, 4.x.x, 5.x.x, 6.x.x


## Presentation

dataframe-js provides another way to work with data in javascript (browser or server side) by using DataFrame, a data structure already used in some languages (Spark, Python, R, ...).

A DataFrame is simply built on two concepts:
- **Columns** provide ways to select your data and reorganize them.
- **Rows** provide ways to modify or filter your data.

````javascript
const df = new DataFrame(data, columns)
df.show()
// DataFrame example
| column1   | column2   | column3   | // <--- Columns
------------------------------------
| 3         | 3         | undefined | // <--- Row
| 6         | 4         | undefined |
| 8         | 5         | undefined |
| undefined | 6         | undefined |
````

dataframe-js provides some **immutable objects** (DataFrame, Row...) and an API closed to **functional** programming and **SQL syntax**. You can sort, groupBy, join, and do complex manipulations with a simple sintax.

It is also compatible (import / export) with native JavaScript objects (Array, Hash...) and other formats (csv, json...).

To resume, dataframe-js contains:
  * A core:
    * DataFrame: Main Object, similar to sql table providing methods to manipulate and transform data.
    * Row: Object contained into a DataFrame, providing lower level manipulations.
    * GroupedDataFrame: DataFrame grouped by columns.


  * Some modules:
    * Stat: Basic statistics computations on DataFrame columns.
    * Matrix: Matrix computations (scalar products, ...).
    * SQL: SQL requests on DataFrame.

## Installation
via git: `npm install git+https://github.com/Gmousse/dataframe-js.git`

via npm: `npm install dataframe-js`

in the browser:
  * not minified: `<script src="https://cdn.rawgit.com/Gmousse/dataframe-js/master/lib/browser/dataframe.js"></script>`

  * minified: `<script src="https://cdn.rawgit.com/Gmousse/dataframe-js/master/lib/browser/dataframe-min.js"></script>`

## Basic Usage

### Import the library

```javascript
// es6
import { DataFrame, Row } from 'dataframe-js';
// es5
var DataFrame = require('dataframe-js').DataFrame;
// Browser
var DataFrame = dfjs.DataFrame;
```

### Create a DataFrame

You can create a DataFrame by using mutiple ways:

```javascript
const df = new DataFrame(data, columns);

// From a collection (easier)
const df = new DataFrame([
    {c1: 1, c2: 6}, // <------- A row
    {c4: 1, c3: 2}
], ['c1', 'c2', 'c3', 'c4']);

// From a table
const df = new DataFrame([
    [1, 6, 9, 10, 12], // <------- A row
    [1, 2],
    [6, 6, 9, 8, 9, 12],
], ['c1', 'c2', 'c3', 'c4', 'c5', 'c6']);

// From a dictionnary (Hash)
const df = new DataFrame({
    column1: [3, 6, 8], // <------ A column
    column2: [3, 4, 5, 6],
}, ['column1', 'column2']);

// From files
DataFrame.fromText('/my/absolue/path/myfile.txt').then(df => df);
DataFrame.fromCSV('http://myurl/myfile.csv').then(df => df);
DataFrame.fromJSON('http://myurl/myfile.json').then(df => df);
DataFrame.fromJSON(new File(...)).then(df => df);
```

### Export or Convert a DataFrame

In the same way, you can also export or convert your DataFrame in files or in JavaScript Objects:

```javascript
const df = new DataFrame(data, columns);

// To native objects
df.toCollection();
df.toArray();
df.toDict();

// To files
DataFrame.toText(true, ';', '/my/absolue/path/myfile.txt');
DataFrame.toCSV('file://my/absolue/path/myfile.csv');
DataFrame.toJSON('/my/absolue/path/myfile.json');
```

### DataFrame

The main Object of the dataframe-js library is the [DataFrame](https://gmousse.gitbooks.io/dataframe-js/content/doc/api/dataframe.html).
It provides 3 types of methods:

Informations, giving details about your DataFrame.
````js
// Some examples
df.show();
df.dim();
````

Columns manipulations, which provide solutions to select, reorganize, cast, join or analyze your data...
````js
// Some examples
df.select('column1', 'column3');
df.cast('column3', String);
df.distinct('column2');
df.innerJoin(df2, ['column2', 'column3']);
````

Rows manipulations, which provide ways to filter, modify, join, complete your data...
````js
// Some examples
df.push([1, 2, 3], [4, 5, 6]);
df.map(row => row.set('column2', row.get('column1') * 2));
df.filter(row => row.get('column2') !== 4);
df.union(df2);
````


### Row

As you could see, the [Row](https://gmousse.gitbooks.io/dataframe-js/content/doc/api/row.html) api is used for example with .map(), .filter() DataFrame methods DataFrame.

The Row API provides simple manipulations, to get, set delete or check data in each line of your DataFrames.
````js
// Some examples
row.get('column1');
row.set('column2', newValue);
````

### GroupedDataFrame

When you use the DataFrame .groupBy() method, new [GroupedDataFrame](https://gmousse.gitbooks.io/dataframe-js/content/doc/api/groupedDataframe.html) object is created.
It can be used to create DataFrame aggregations (like SQL) in order to resume your data.

Each group in the GroupedDataFrame is a DataFrame. When you aggregate a GroupedDataFrame Object, you get a DataFrame with one line per group, and with a new column "aggregation".
````js
// Some examples
const groupedDF = df.groupBy('column1', 'column2');
groupedDF.aggregate(group => group.count()).rename('aggregation', 'groupCount');
df.groupBy('column2', 'column3').aggregate(group => group.stat.mean('column4')).rename('aggregation', 'groupMean');
````

### Stat Module

The [Stat](https://gmousse.gitbooks.io/dataframe-js/content/doc/api/modules/stat.html)
 module provides basic statistical computations on a DataFrame columns.

````js
// Some examples
df.stat.max('column1');
df.stat.mean('column1');
````

### Matrix Module

The [Matrix](https://gmousse.gitbooks.io/dataframe-js/content/doc/api/modules/matrix.html) module provides mathematical matrix operations between DataFrames.

````js
// Some examples
df.matrix.add(df2);
df.matrix.product(8);
df.matrix.dot(df2);
````

### SQL Module

To finish, the [SQL](https://gmousse.gitbooks.io/dataframe-js/content/doc/api/modules/sql.html) module allows you to register temporary tables and to request on these, by using SQL syntax.

````js
// Some examples
// Register a tmp table
df.sql.register('tmp2')
DataFrame.sql.registerTable(df, 'tmp2')
// Request on Table
DataFrame.sql.request('SELECT * FROM tmp2 WHERE column1 = 6')
````

## Advanced Usage

### Module creation

Each module is a class with a constructor taking dataframe as parameter, and having a df and a name properties:

```javascript
class FakeModule {
    constructor(dataframe) {
        this.df = dataframe;
        this.name = 'fakemodule';
    }

    test(x) {
        return this.df.withColumn('test', row => row.set('test', x * 2));
    }
}
```

### Module registration

You can register modules when you instantiate a DataFrame:

```javascript
const df = new DataFrame(data, ['column1', 'column2', 'column3'], FakeModule, AnotherModule)
// You can call module by its name
df.fakemodule.test(4)

console.log(df.modules);
// [SQL, Matrix, Stat, FakeModule, AnotherModule]
```

You can also set default modules:

````javascript
DataFrame.setDefaultModules(FakeModule, Matrix);
const df = new DataFrame(data, ['column1', 'column2', 'column3'])

console.log(df.modules);
// [FakeModule, Matrix]
````

## API Reference

[Index](https://gmousse.gitbooks.io/dataframe-js/content/#api-reference)
  * Core:
  [DataFrame](https://gmousse.gitbooks.io/dataframe-js/content/doc/api/dataframe.html), [Row](https://gmousse.gitbooks.io/dataframe-js/content/doc/api/row.html), [GroupedDataFrame](https://gmousse.gitbooks.io/dataframe-js/content/doc/api/groupedDataframe.html)
  * Modules:
  [Stat](https://gmousse.gitbooks.io/dataframe-js/content/doc/api/modules/stat.html),
  [Matrix](https://gmousse.gitbooks.io/dataframe-js/content/doc/api/modules/matrix.html),
  [SQL](https://gmousse.gitbooks.io/dataframe-js/content/doc/api/modules/sql.html)


## Contribution

[How to contribute ?](https://gmousse.gitbooks.io/dataframe-js/content/CONTRIBUTING.html)
