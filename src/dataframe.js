import { match, transpose, chain, iter, arrayEqual, saveFile } from './reusables.js';
import { InputTypeError, WrongSchemaError, MixedTypeError } from './errors.js';
import Row from './row.js';
import GroupedDataFrame from './groupedDataframe.js';

const __columns__ = Symbol('columns');
const __rows__ = Symbol('rows');

/**
 * DataFrame data structure providing an immutable, flexible and powerfull way to manipulate data with columns and rows.
 */
class DataFrame {

    /**
     * Set the default modules used in DataFrame instances.
     * @param {...Object} defaultModules DataFrame modules used by default.
     * @example
     * DataFrame.setDefaultModules(SQL, Stat)
     */
    static setDefaultModules(...defaultModules) {
        DataFrame.defaultModules = defaultModules;
    }

    /**
     * Create a new DataFrame.
     * @param {Array | Object | DataFrame} data The data of the DataFrame.
     * @param {Array} columns The DataFrame column names.
     * @param {...Object} [modules] Additional modules.
     * @example
     * new DataFrame({
     *      'column1': [3, 6, 8],
     *      'column2': [3, 4, 5, 6],
     * }, ['column1', 'column2'])
     *
     * new Data Frame([
     *      [1, 6, 9, 10, 12],
     *      [1, 2],
     *      [6, 6, 9, 8, 9, 12],
     * ], ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'])
     *
     * new DataFrame([
     *      {c1: 1, c2: 6, c3: 9, c4: 10, c5: 12},
     *      {c4: 1, c3: 2},
     *      {c1: 6, c5: 6, c2: 9, c4: 8, c3: 9, c6: 12},
     * ], ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'])
     *
     * new DataFrame(df);
     */
    constructor(data, columns, ...modules) {
        [this[__rows__], this[__columns__]] = this._build(data, this._dropSpacesInColumnNames(columns));
        this.modules = DataFrame.defaultModules ? [...DataFrame.defaultModules, ...modules] : modules;
        Object.assign(this, ...this.__instanciateModules__(this.modules));
    }

    * [Symbol.iterator]() {
        for (const row of this[__rows__]) {
            yield row;
        }
    }

    __newInstance__(data, columns) {
        if (!arrayEqual(columns, this[__columns__]) || !(data[0] instanceof Row)) {
            return new DataFrame(data, this._dropSpacesInColumnNames(columns), ...this.modules);
        }
        const newInstance = Object.assign(
            Object.create(
                Object.getPrototypeOf(this)
            ), this, {[__rows__]: [...data], [__columns__]: [...this._dropSpacesInColumnNames(columns)]}
        );
        return Object.assign(newInstance, ...this.__instanciateModules__(this.modules, newInstance));
    }

    __instanciateModules__(modules, df = undefined) {
        return modules.map(Plugin => {
            const pluginInstance = new Plugin(df ? df : this);
            return {[pluginInstance.name]: pluginInstance};
        });
    }

    _dropSpacesInColumnNames(columns) {
        return columns ? columns.map(column => String(column).replace(' ', '')) : columns;
    }

    _build(data, columns) {
        return match(data,
            [
                (value) => (value instanceof DataFrame),
                () => this._fromArray([...data[__rows__]], columns ? columns : data[__columns__]),
            ],
            [
                (value) => (value instanceof Array),
                () => this._fromArray(data, columns ? columns :
                     [...new Set(data.map(row => Object.keys(row)).reduce((p, n) => [...p, ...n]))]
                ),
            ],
            [
                (value) => (value instanceof Object),
                () => this._fromDict(data, columns ? columns : Object.keys(data)),
            ],
            [
                () => true,
                () => {throw new InputTypeError('data', ['Object', 'Array', 'DataFrame'], typeof data);},
            ]);
    }

    _fromDict(dict, columns) {
        return [transpose(Object.values(dict)).map(row => new Row(row, columns)), columns];
    }

    _fromArray(array, columns) {
        return [array.map(row => new Row(row, columns)), columns];
    }

    _joinByType(gdf1, gdf2, type) {
        if (type === 'out' || type === 'in') {
            const gdf2Groups = gdf2.listGroups().map(groupKey => Object.values(groupKey)[0]);
            return gdf1.toCollection().map(({group, groupKey}) => {
                const isContained = gdf2Groups.includes(Object.values(groupKey)[0]);
                const filterCondition = (bool) => bool ? group : false;
                return type === 'out' ? filterCondition(!isContained) : filterCondition(isContained);
            }).filter(group => group);
        }
        return gdf1.toCollection().map(({group}) => group);
    }

    _join(dfToJoin, on, types) {
        const newColumns = [...new Set([...this.listColumns(), ...dfToJoin.listColumns()])];
        const gdf = this.groupBy(on);
        const gdfToJoin = dfToJoin.groupBy(on);
        return [...iter([
            ...this._joinByType(gdf, gdfToJoin, types[0]),
            ...this._joinByType(gdfToJoin, gdf, types[1]),
        ], group => group.restructure(newColumns))].reduce((p, n) => p.union(n));
    }

    /**
     * Convert DataFrame into dict / hash / object.
     * @returns {Object} The DataFrame converted into dict.
     * @example
     * df.toDict()
     */
    toDict() {
        return Object.assign({}, ...Object.entries(
            this.transpose().toArray()
        ).map(([index, column]) => ({[this[__columns__][index]]: column})));
    }

    /**
     * Convert DataFrame into Array of Arrays. You can also extract only one column as Array.
     * @param {String} [columnName] Column Name to extract. By default, all columns are transformed.
     * @returns {Array} The DataFrame (or the column) converted into Array.
     * @example
     * df.toArray()
     */
    toArray(columnName) {
        return columnName ? [...this].map(row => row.get(columnName)) : [...this].map(row => row.toArray());
    }

    /**
     * Convert DataFrame into Array of dictionnaries. You can also return Rows instead of dictionnaries.
     * @param {Boolean} [ofRows] Return a collection of Rows instead of dictionnaries.
     * @returns {Array} The DataFrame converted into Array of dictionnaries (or Rows).
     * @example
     * df.toCollection()
     */
    toCollection(ofRows) {
        return ofRows ? [...this] : [...this].map(row => row.toDict());
    }

    /**
     * Convert the DataFrame into a text string. You can also save the file if you are using nodejs.
     * @param {String} [sep=' '] Column separator.
     * @param {Boolean} [header=true] Writing the header in the first line. If false, there will be no header.
     * @param {String} [path] The path to save the file. /!\ Works only on node.js, not into the browser.
     * @returns {String} The text file in raw string.
     * @example
     * df.toText()
     * df.toText(';')
     * df.toText(';', true)
     * df.toText(';', true, '~/dataframe.txt')
     */
    toText(sep = ';', header = true, path = undefined) {
        const csvContent = this.reduce(
            (p, n) => `${p ? p + '\n' : ''}${n.toArray().join(sep)}`,
            header ? this[__columns__].join(sep) : ''
        );
        if (path) {saveFile(path, csvContent);}
        return csvContent;
    }

    /**
     * Convert the DataFrame into a csv string. You can also save the file if you are using nodejs.
     * @param {Boolean} [header=true] Writing the header in the first line. If false, there will be no header.
     * @param {String} [path] The path to save the file. /!\ Works only on node.js, not into the browser.
     * @returns {String} The csv file in raw string.
     * @example
     * df.toCSV()
     * df.toCSV(true)
     * df.toCSV(true, '~/dataframe.csv')
     */
    toCSV(header = true, path = undefined) {
        return this.toText(',', header, path);
    }

    /**
     * Convert the DataFrame into a json string. You can also save the file if you are using nodejs.
     * @param {String} [path] The path to save the file. /!\ Works only on node.js, not into the browser.
     * @returns {String} The json file in raw string.
     * @example
     * df.toJSON()
     * df.toJSON('~/dataframe.json')
     */
    toJSON(path = undefined) {
        const jsonContent = JSON.stringify(this.toDict());
        if (path) {saveFile(path, jsonContent);}
        return jsonContent;
    }

    /**
     * Display the DataFrame as String Table. Can only return a sring instead of displaying the DataFrame.
     * @param {Number} [rows=10] The number of lines to display.
     * @param {Boolean} [quiet=false] Quiet mode. If true, only returns a string instead of console.log().
     * @returns {String} The DataFrame as String Table.
     * @example
     * df.show()
     * df.show(10)
     * const stringDF = df.show(10, true)
     */
    show(rows = 10, quiet = false) {
        const makeRow = (row) => (
            `| ${row.map(
                column => {
                    const columnAsString = String(column);
                    return columnAsString.length > 9 ? columnAsString.substring(0, 6) + '...' :
                        columnAsString + Array(10 - columnAsString.length).join(' ');
                }
            ).join(' | ')} |`
        );
        const header = makeRow(this[__columns__]);
        let token = 0;
        const toShow = [
            header,
            Array(header.length).join('-'),
            ...iter(this[__rows__], row => {token++; return makeRow(row.toArray());}, () => token >= rows),
        ].join('\n');
        if (!quiet) {console.log(toShow);}
        return toShow;
    }

    /**
     * Get the DataFrame dimensions.
     * @returns {Array} The DataFrame dimensions. [height, weight]
     * @example
     * const [height, weight] = df.dim()
     */
    dim() {
        return [this.count(), this[__columns__].length];
    }

    /**
     * Transpose a DataFrame. Rows become columns and conversely. n x p => p x n.
     * @returns {ÐataFrame} A new transpoded DataFrame.
     * @example
     * df.transpose()
     */
    transpose() {
        const newColumns = [...Array(this.count()).keys()];
        return this.__newInstance__(transpose(this.toArray()), newColumns);
    }

    /**
     * Get the rows number.
     * @returns {Int} The number of DataFrame rows.
     * @example
     * df.count()
     */
    count() {
        return this[__rows__].length;
    }

    /**
     * Get the count of a value into a column.
     * @param valueToCount The value to count into the selected column.
     * @param {String} [columnName=this.listColumns()[0]] The column where found the value.
     * @returns {Int} The number of times the selected value appears.
     * @example
      * df.countValue(5, 'column2')
      * df.select('column1').countValue(5)
     */
    countValue(valueToCount, columnName = this[__columns__][0]) {
        return this.filter(row => row.get(columnName) === valueToCount).count();
    }

    /**
     * Push new rows into the DataFrame.
     * @param {Array | Row} rows The rows to add.
     * @returns {DataFrame} A new DataFrame with the new rows.
     * @example
      * df.push([1,2,3], [1,4,9])
     */
    push(...rows) {
        return this.union(new DataFrame(rows, this[__columns__]));
    }

    /**
     * Replace a value by another in the DataFrame or in a column.
     * @param value The value to replace.
     * @param replacement The new value.
     * @param {...String} [columnNames=this.listColumns()] The columns where to apply the replacement.
     * @returns {DataFrame} A new DataFrame with replaced values.
     * @example
     * df.replace(undefined, 0, 'column1', 'column2')
     */
    replace(value, replacement, ...columnNames) {
        return this.map(row => (columnNames.length > 0 ? columnNames : this[__columns__]).reduce(
                (p, n) => p.get(n) === value ? p.set(n, replacement) : p, row
            ));
    }

    /**
     * Compute unique values into a column.
     * @param {String} columnName The column to distinct.
     * @returns {Array} An Array containing distinct values of the column.
     * @example
     * df.distinct('column1')
     */
    distinct(columnName) {
        return this.__newInstance__(
            {[columnName]: [...new Set(this.toArray(columnName))]}, [columnName]
        );
    }

    /**
     * Compute unique values into a column.
     * Alias from .distinct()
     * @param {String} columnName The column to distinct.
     * @returns {Array} An Array containing distinct values of the column.
     * @example
     * df.unique('column1')
     */
    unique(columnName) {
        return this.distinct(columnName);
    }

    /**
     * List DataFrame columns.
     * @returns {Array} An Array containing DataFrame columnNames.
     * @example
     * df.listColumns()
     */
    listColumns() {
        return [...this[__columns__]];
    }

    /**
     * Select columns in the DataFrame.
     * @param {...String} columnNames The columns to select.
     * @returns {DataFrame} A new DataFrame containing selected columns.
     * @example
     * df.select('column1', 'column3')
     */
    select(...columnNames) {
        return this.__newInstance__(this[__rows__].map(
            row => row.select(...columnNames)
        ), columnNames);
    }

    /**
     * Add a new column or set an existing one.
     * @param {String} columnName The column to modify or to create.
     * @param {Function} [func=(row, index) => undefined] The function to create the column.
     * @returns {DataFrame} A new DataFrame containing the new or modified column.
     * @example
     * df.withColumn('column4', () => 2)
     * df.withColumn('column2', (row) => row.get('column2') * 2)
     */
    withColumn(columnName, func = () => undefined) {
        return this.__newInstance__(this[__rows__].map(
            (row, index) => {
                return row.set(columnName, func(row, index));
            }
        ), this[__columns__].includes(columnName) ? this[__columns__] : [...this[__columns__], columnName]);
    }

    /**
     * Modify the structure of the DataFrame by changing columns order, creating new columns or removing some columns.
     * @param {Array} newColumnNames The new columns of the DataFrame.
     * @returns {DataFrame} A new DataFrame with different columns (renamed, add or deleted).
     * @example
     * df.restructure(['column1', 'column4', 'column2', 'column3'])
     * df.restructure(['column1', 'column4'])
     * df.restructure(['column1', 'newColumn', 'column4'])
     */
    restructure(newColumnNames) {
        return this.__newInstance__(this[__rows__], newColumnNames);
    }

    /**
     * Rename columns.
     * @param {Array} newColumnNames The new column names of the DataFrame.
     * @returns {DataFrame} A new DataFrame with the new column names.
     * @example
     * df.renameAll(['column1', 'column3', 'column4'])
     */
    renameAll(newColumnNames) {
        if (newColumnNames.length !== this[__columns__].length) {
            throw new WrongSchemaError(newColumnNames, this[__columns__]);
        }
        return this.__newInstance__(this[__rows__].map(row => row.toArray()), newColumnNames);
    }

    /**
     * Rename a column.
     * @param {String} columnName The column to rename.
     * @param {String} replacement The new name for the column.
     * @returns {DataFrame} A new DataFrame with the new column name.
     * @example
     * df.rename('column1', 'columnRenamed')
     */
    rename(columnName, replacement) {
        const newColumnNames = this[__columns__].map(column => column === columnName ? replacement : column);
        return this.renameAll(newColumnNames);
    }

    /**
     * Remove a single column.
     * @param {String} columnName The column to drop.
     * @returns {DataFrame} A new DataFrame without the dropped column.
     * @example
     * df.drop('column2')
     */
    drop(columnName) {
        return this.__newInstance__(this[__rows__].map(
            (row) => row.delete(columnName)
        ), this[__columns__].filter(column => column !== columnName));
    }

    /**
     * Chain maps and filters functions on DataFrame by optimizing their executions.
     * If a function returns boolean, it's a filter. Else it's a map.
     * It can be 10 - 100 x faster than standard chains of .map() and .filter().
     * @param {...Function} funcs Functions to apply on the DataFrame rows taking the row as parameter.
     * @returns {DataFrame} A new DataFrame with modified rows.
     * @example
     * df.chain(
     *      row => row.get('column1') > 3, // filter
     *      row => row.set('column1', 3),  // map
     *      row => row.get('column2') === '5' // filter
     * )
     */
    chain(...funcs) {
        return this.__newInstance__([...chain(this[__rows__], ...funcs)], this[__columns__]);
    }

    /**
     * Filter DataFrame rows.
     * @param {Function | Object} condition A filter function or a column/value object.
     * @returns {DataFrame} A new filtered DataFrame.
     * @example
     * df.filter(row => row.get('column1') >= 3)
     * df.filter({'column2': 5, 'column1': 3}))
     */
    filter(condition) {
        const func = typeof condition === 'object' ?
            row => Object.entries(condition).map(([column, value]) => Object.is(row.get(column), value)).reduce((p, n) => p && n)
        : condition;
        const filteredRows = [...iter(this[__rows__], row => func(row) ? row : false)];
        return filteredRows.length > 0 ? this.__newInstance__(filteredRows, this[__columns__]) : this.__newInstance__([], []);
    }

    /**
     * Find a row (the first met) based on a condition.
     * @param {Function | Object} condition A filter function or a column/value object.
     * @returns {Row} The targeted Row.
     * @example
     * df.find(row => row.get('column1') === 3)
     * df.find({'column1': 3})
     */
    find(condition) {
        return this.filter(condition)[__rows__][0];
    }

    /**
     * Filter DataFrame rows.
     * Alias of .filter()
     * @param {Function | Object} condition A filter function or a column/value object.
     * @returns {DataFrame} A new filtered DataFrame.
     * @example
     * df.where(row => row.get('column1') >= 3)
     * df.where({'column2': 5, 'column1': 3}))
     */
    where(condition) {
        return this.filter(condition);
    }

    /**
     * Map on DataFrame rows. /!\ Prefer to use .chain().
     * @param {Function} func A function to apply on each row taking the row as parameter.
     * @returns {DataFrame} A new DataFrame with modified rows.
     * @example
     * df.map(row => row.set('column1', row.get('column1') * 2))
     */
    map(func) {
        return this.__newInstance__([...iter(this[__rows__], row => func(row))], this[__columns__]);
    }

    /**
     * Reduce DataFrame into a value.
     * @param {Function} func The reduce function taking 2 parameters, previous and next.
     * @param [init] The initial value of the reducer.
     * @returns A reduced value.
     * @example
     * df.reduce((p, n) => n.get('column1') + p, 0)
     * df2.reduce((p, n) => (
     *          n.set('column1', p.get('column1') + n.get('column1'))
     *           .set('column2', p.get('column2') + n.get('column2'))
     * ))
     */
    reduce(func, init) {
        return typeof init === 'undefined' ? this[__rows__].reduce((p, n) => func(p, n)) :
         this[__rows__].reduce((p, n) => func(p, n), init);
    }

    /**
     * Reduce DataFrame into a value, starting from the last row (see .reduce()).
     * @param {Function} func The reduce function taking 2 parameters, previous and next.
     * @param [init] The initial value of the reducer.
     * @returns A reduced value.
     * @example
     * df.reduceRight((p, n) => p > n ? p : n, 0)
     */
    reduceRight(func, init) {
        return typeof init === 'undefined' ? this[__rows__].reduceRight((p, n) => func(p, n)) :
         this[__rows__].reduceRight((p, n) => func(p, n), init);
    }

    /**
     * Return a shuffled DataFrame rows.
     * @returns {DataFrame} A shuffled DataFrame
     * @example
     * df.shuffle()
     */
     shuffle() {
         return this.__newInstance__(
             this.reduce(
                 (p, n) => {
                     const index = Math.floor(Math.random() * (p.length - 1) + 1);
                     return Array.isArray(p) ? [...p.slice(index, p.length + 1), n, ...p.slice(0, index)] :
                        [p, n];
                 }
             )
             , this[__columns__]
         );
     }

    /**
     * Return a random sample of rows.
     * @param {Number} percentage A percentage of the orignal DataFrame giving the sample size.
     * @returns {DataFrame} A sample DataFrame
     * @example
     * df.sample(0.3)
     */
    sample(percentage) {
        const nRows = this.count() * percentage;
        let token = 0;
        return this.__newInstance__([...iter(
            this.shuffle()[__rows__], row => {
                token++;
                return row;
            }, () => token >= nRows
        )], this[__columns__]);
    }

    /**
     * Randomly split a DataFrame into 2 DataFrames.
     * @param {Number} percentage A percentage of the orignal DataFrame giving the first DataFrame size. The second takes the rest.
     * @returns {Array} An Array containing the two DataFrames. First, the X% DataFrame then the rest DataFrame.
     * @example
     * const [30DF, 70DF] = df.bisect(0.3)
     */
    bisect(percentage) {
        const nRows = this.count() * percentage;
        let token = 0;
        const restRows = [];
        return [this.__newInstance__([...iter(
            this.shuffle()[__rows__], row => {
                if (token < nRows) {
                    token++;
                    return row;
                }
                restRows.push(row);
            }
        )], this[__columns__]),
        this.__newInstance__(restRows, this[__columns__])];
    }

    /**
     * Group DataFrame rows by columns giving a GroupedDataFrame object. See its doc for more examples.
     * @param {...String} columnNames The columns used for the groupBy.
     * @returns {GroupedDataFrame} A GroupedDataFrame object.
     * @example
     * df.groupBy('column1')
     * df.groupBy('column1', 'column2')
     * df.groupBy('column1', 'column2').listGroups()
     * df.groupBy('column1', 'column2').show()
     * df.groupBy('column1', 'column2').aggregate((group) => group.count())
     */
    groupBy(...columnNames) {
        return new GroupedDataFrame(this, ...columnNames);
    }

    /**
     * Sort DataFrame rows based on a column values. The row should contains only one variable type.
     * @param {String} columnName The column giving order.
     * @param {Boolean} [reverse=false] Reverse mode. Reverse the order if true.
     * @returns {DataFrame} An ordered DataFrame.
     * @example
     * df.sortBy('id')
     */
    sortBy(columnName, reverse = false) {
        const sortedRows = this[__rows__].sort((p, n) => {
            const [pValue, nValue] = [p.get(columnName), n.get(columnName)];
            if (typeof pValue !== typeof nValue) { throw new MixedTypeError(); }
            return pValue - nValue;
        });
        return this.__newInstance__(reverse ? sortedRows.reverse() : sortedRows, this[__columns__]);
    }

    /**
     * Concat two DataFrames.
     * @param {DataFrame} dfToUnion The DataFrame to concat.
     * @returns {DataFrame} A new concatenated DataFrame resulting of the union.
     * @example
     * df.union(df2)
     */
    union(dfToUnion) {
        if (!arrayEqual(this[__columns__], dfToUnion[__columns__])) {
            throw new WrongSchemaError(dfToUnion[__columns__], this[__columns__]);
        }
        return this.__newInstance__([...this, ...dfToUnion], this[__columns__]);
    }

    /**
     * Join two DataFrames.
     * @param {DataFrame} dfToJoin The DataFrame to join.
     * @param {String} on The selected column for the join.
     * @param {String} [how='full'] The join mode. Can be: full, inner, outer, left, right.
     * @returns {DataFrame} The joined DataFrame.
     * @example
     * df.join(df2, 'column1', 'full')
     */
    join(dfToJoin, on, how = 'inner') {
        const joinMethods = {
            inner: () => this.innerJoin(dfToJoin, on),
            full: () => this.fullJoin(dfToJoin, on),
            outer: () => this.outerJoin(dfToJoin, on),
            left: () => this.leftJoin(dfToJoin, on),
            right: () => this.rightJoin(dfToJoin, on),
        };
        return joinMethods[how]();
    }

    /**
     * Join two DataFrames with inner mode.
     * @param {DataFrame} dfToJoin The DataFrame to join.
     * @param {String} on The selected column for the join.
     * @returns {DataFrame} The joined DataFrame.
     * @example
     * df.innerJoin(df2, 'id')
     * df.join(df2, 'id')
     * df.join(df2, 'id', 'inner')
     */
    innerJoin(dfToJoin, on) {
        return this._join(dfToJoin, on, ['in', 'in']);
    }

    /**
     * Join two DataFrames with full mode.
     * @param {DataFrame} dfToJoin The DataFrame to join.
     * @param {String} on The selected column for the join.
     * @returns {DataFrame} The joined DataFrame.
     * @example
     * df.fullJoin(df2, 'id')
     * df.join(df2, 'id', 'full')
     */
    fullJoin(dfToJoin, on) {
        return this._join(dfToJoin, on, ['', '']);
    }

    /**
     * Join two DataFrames with outer mode.
     * @param {DataFrame} dfToJoin The DataFrame to join.
     * @param {String} on The selected column for the join.
     * @returns {DataFrame} The joined DataFrame.
     * @example
     * df2.rightJoin(df2, 'id')
     * df2.join(df2, 'id', 'outer')
     */
    outerJoin(dfToJoin, on) {
        return this._join(dfToJoin, on, ['out', 'out']);
    }

    /**
     * Join two DataFrames with left mode.
     * @param {DataFrame} dfToJoin The DataFrame to join.
     * @param {String} on The selected column for the join.
     * @returns {DataFrame} The joined DataFrame.
     * @example
     * df.leftJoin(df2, 'id')
     * df.join(df2, 'id', 'left')
     */
    leftJoin(dfToJoin, on) {
        return this._join(dfToJoin, on, ['', 'in']);
    }

    /**
     * Join two DataFrames with right mode.
     * @param {DataFrame} dfToJoin The DataFrame to join.
     * @param {String} on The selected column for the join.
     * @returns {DataFrame} The joined DataFrame.
     * @example
     * df.rightJoin(df2, 'id')
     * df.join(df2, 'id', 'right')
     */
    rightJoin(dfToJoin, on) {
        return this._join(dfToJoin, on, ['in', '']);
    }
}

export default DataFrame;
