/**
 * Catch an error on a function and returns it.
 * @param {Function} func The function to evaluate.
 * @returns {Object} The Error generated by the function.
 */
export function tryCatch(func) {
    try {
        func();
    } catch (err) {
        return err;
    }
}
