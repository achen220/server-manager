"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertToFlatConfigGenerator = convertToFlatConfigGenerator;
const devkit_1 = require("@nx/devkit");
const eslint_file_1 = require("../utils/eslint-file");
const plugin_1 = require("../utils/plugin");
const path_1 = require("path");
const versions_1 = require("../../utils/versions");
const json_converter_1 = require("./converters/json-converter");
async function convertToFlatConfigGenerator(tree, options) {
    const eslintFile = (0, eslint_file_1.findEslintFile)(tree);
    if (!eslintFile) {
        throw new Error('Could not find root eslint file');
    }
    if (eslintFile.endsWith('.js')) {
        throw new Error('Only json and yaml eslint config files are supported for conversion');
    }
    options.eslintConfigFormat ??= 'mjs';
    const eslintIgnoreFiles = new Set(['.eslintignore']);
    // convert root eslint config to eslint.config.cjs or eslint.base.config.mjs based on eslintConfigFormat
    convertRootToFlatConfig(tree, eslintFile, options.eslintConfigFormat);
    // convert project eslint files to eslint.config.cjs
    const projects = (0, devkit_1.getProjects)(tree);
    for (const [project, projectConfig] of projects) {
        convertProjectToFlatConfig(tree, project, projectConfig, (0, devkit_1.readNxJson)(tree), eslintIgnoreFiles, options.eslintConfigFormat);
    }
    // delete all .eslintignore files
    for (const ignoreFile of eslintIgnoreFiles) {
        tree.delete(ignoreFile);
    }
    // replace references in nx.json and project.json files
    updateNxJsonConfig(tree, options.eslintConfigFormat);
    updateProjectConfigsInputs(tree, options.eslintConfigFormat);
    // install missing packages
    if (!options.skipFormat) {
        await (0, devkit_1.formatFiles)(tree);
    }
    return () => (0, devkit_1.installPackagesTask)(tree);
}
exports.default = convertToFlatConfigGenerator;
function convertRootToFlatConfig(tree, eslintFile, format) {
    if (/\.base\.(js|json|yml|yaml)$/.test(eslintFile)) {
        convertConfigToFlatConfig(tree, '', eslintFile, `eslint.base.config.${format}`, format);
    }
    convertConfigToFlatConfig(tree, '', eslintFile.replace('.base.', '.'), `eslint.config.${format}`, format);
}
const ESLINT_LINT_EXECUTOR = '@nx/eslint:lint';
function isEslintTarget(target) {
    return (target.executor === ESLINT_LINT_EXECUTOR ||
        target.command?.includes('eslint'));
}
function convertProjectToFlatConfig(tree, project, projectConfig, nxJson, eslintIgnoreFiles, format) {
    const eslintFile = (0, eslint_file_1.findEslintFile)(tree, projectConfig.root);
    if (!eslintFile || eslintFile.endsWith('.js')) {
        return;
    }
    // Clean up obsolete target options and detect explicit ESLint targets
    let ignorePath;
    const eslintTargets = projectConfig.targets
        ? Object.keys(projectConfig.targets).filter((t) => isEslintTarget(projectConfig.targets[t]))
        : [];
    for (const target of eslintTargets) {
        if (projectConfig.targets[target].options?.eslintConfig) {
            delete projectConfig.targets[target].options.eslintConfig;
        }
        if (projectConfig.targets[target].options?.ignorePath) {
            ignorePath = projectConfig.targets[target].options.ignorePath;
            delete projectConfig.targets[target].options.ignorePath;
        }
    }
    if (eslintTargets.length > 0) {
        (0, devkit_1.updateProjectConfiguration)(tree, project, projectConfig);
    }
    const hasEslintTargetDefaults = projectConfig.targets &&
        Object.keys(nxJson.targetDefaults || {}).some((t) => (t === ESLINT_LINT_EXECUTOR ||
            isEslintTarget(nxJson.targetDefaults[t])) &&
            projectConfig.targets[t]);
    if (eslintTargets.length === 0 &&
        !hasEslintTargetDefaults &&
        !(0, plugin_1.hasEslintPlugin)(tree)) {
        devkit_1.logger.warn(`Skipping "${project}": found ${eslintFile} but no ESLint lint target detected. Convert manually if needed.`);
        return;
    }
    convertConfigToFlatConfig(tree, projectConfig.root, eslintFile, `eslint.config.${format}`, format, ignorePath);
    eslintIgnoreFiles.add(`${projectConfig.root}/.eslintignore`);
    if (ignorePath) {
        eslintIgnoreFiles.add(ignorePath);
    }
}
// Rewrites input entries that reference legacy `.eslintrc[.base].json` / `.eslintignore`
// files to their flat-config counterparts, then dedupes so the rewrite doesn't produce
// duplicates of entries that already pointed at the flat config. Leaves non-string /
// non-fileset inputs (runtime/env/dependentTasksOutputFiles/etc.) untouched.
function rewriteLegacyInputs(inputs, format) {
    const seenStrings = new Set();
    const result = [];
    for (const entry of inputs) {
        if (typeof entry === 'string') {
            const rewritten = (0, json_converter_1.renameLegacyEslintrcFile)(entry, format);
            if (seenStrings.has(rewritten))
                continue;
            seenStrings.add(rewritten);
            result.push(rewritten);
        }
        else if ('fileset' in entry) {
            const rewritten = (0, json_converter_1.renameLegacyEslintrcFile)(entry.fileset, format);
            // Preserve the original reference when nothing changed so downstream identity
            // checks (e.g. `inputsEqual`) don't see a spurious mutation.
            result.push(rewritten === entry.fileset ? entry : { ...entry, fileset: rewritten });
        }
        else {
            result.push(entry);
        }
    }
    return result;
}
// Adds `value` to `inputs` (after rewriting) when the rewritten set doesn't already contain it.
function ensureInputPresent(inputs, value, format) {
    const rewritten = rewriteLegacyInputs(inputs, format);
    if (!rewritten.some((entry) => entry === value)) {
        rewritten.push(value);
    }
    return rewritten;
}
// Updates nx.json: rewrites stale eslintrc/eslintignore references across all targetDefaults
// inputs and namedInputs, and ensures lint targets include the new flat config file as an input
// (and `production` excludes it).
function updateNxJsonConfig(tree, format) {
    if (!tree.exists('nx.json')) {
        return;
    }
    (0, devkit_1.updateJson)(tree, 'nx.json', (json) => {
        if (json.targetDefaults) {
            for (const [name, target] of Object.entries(json.targetDefaults)) {
                if (!target.inputs)
                    continue;
                const isLintTarget = name === 'lint' || name === ESLINT_LINT_EXECUTOR;
                target.inputs = isLintTarget
                    ? ensureInputPresent(target.inputs, `{workspaceRoot}/eslint.config.${format}`, format)
                    : rewriteLegacyInputs(target.inputs, format);
            }
        }
        if (json.namedInputs) {
            for (const [name, inputs] of Object.entries(json.namedInputs)) {
                json.namedInputs[name] =
                    name === 'production'
                        ? ensureInputPresent(inputs, `!{projectRoot}/eslint.config.${format}`, format)
                        : rewriteLegacyInputs(inputs, format);
            }
        }
        return json;
    });
}
// Walks every project's `targets.*.inputs` and `namedInputs.*`, rewriting stale references.
function updateProjectConfigsInputs(tree, format) {
    for (const [project, projectConfig] of (0, devkit_1.getProjects)(tree)) {
        let changed = false;
        if (projectConfig.targets) {
            for (const target of Object.values(projectConfig.targets)) {
                if (!target.inputs)
                    continue;
                const rewritten = rewriteLegacyInputs(target.inputs, format);
                if (!inputsEqual(target.inputs, rewritten)) {
                    target.inputs = rewritten;
                    changed = true;
                }
            }
        }
        if (projectConfig.namedInputs) {
            for (const [name, inputs] of Object.entries(projectConfig.namedInputs)) {
                const rewritten = rewriteLegacyInputs(inputs, format);
                if (!inputsEqual(inputs, rewritten)) {
                    projectConfig.namedInputs[name] = rewritten;
                    changed = true;
                }
            }
        }
        if (changed) {
            (0, devkit_1.updateProjectConfiguration)(tree, project, projectConfig);
        }
    }
}
function inputsEqual(a, b) {
    return a.length === b.length && a.every((entry, i) => entry === b[i]);
}
function convertConfigToFlatConfig(tree, root, source, target, format, ignorePath) {
    const ignorePaths = ignorePath
        ? [ignorePath, `${root}/.eslintignore`]
        : [`${root}/.eslintignore`];
    // `.eslintrc` (no extension) is JSON by convention.
    if (source.endsWith('.json') || (0, path_1.basename)(source) === '.eslintrc') {
        const config = (0, devkit_1.readJson)(tree, `${root}/${source}`);
        const conversionResult = (0, json_converter_1.convertEslintJsonToFlatConfig)(tree, root, config, ignorePaths, format);
        return processConvertedConfig(tree, root, source, target, conversionResult);
    }
    if (source.endsWith('.yaml') || source.endsWith('.yml')) {
        const originalContent = tree.read(`${root}/${source}`, 'utf-8');
        const { load } = require('@zkochan/js-yaml');
        const config = load(originalContent, {
            json: true,
            filename: source,
        });
        const conversionResult = (0, json_converter_1.convertEslintJsonToFlatConfig)(tree, root, config, ignorePaths, format);
        return processConvertedConfig(tree, root, source, target, conversionResult);
    }
}
function processConvertedConfig(tree, root, source, target, { content, addESLintRC, addESLintJS, }) {
    // remove original config file
    tree.delete((0, path_1.join)(root, source));
    // save new
    tree.write((0, path_1.join)(root, target), content);
    // These dependencies are required for flat configs that are generated by subsequent app/lib generators.
    const devDependencies = {
        eslint: versions_1.eslint9__eslintVersion,
        'eslint-config-prettier': versions_1.eslintConfigPrettierVersion,
        'typescript-eslint': versions_1.eslint9__typescriptESLintVersion,
        '@typescript-eslint/eslint-plugin': versions_1.eslint9__typescriptESLintVersion,
        '@typescript-eslint/parser': versions_1.eslint9__typescriptESLintVersion,
    };
    if ((0, devkit_1.getDependencyVersionFromPackageJson)(tree, '@typescript-eslint/utils')) {
        devDependencies['@typescript-eslint/utils'] =
            versions_1.eslint9__typescriptESLintVersion;
    }
    if ((0, devkit_1.getDependencyVersionFromPackageJson)(tree, '@typescript-eslint/type-utils')) {
        devDependencies['@typescript-eslint/type-utils'] =
            versions_1.eslint9__typescriptESLintVersion;
    }
    // add missing packages
    if (addESLintRC) {
        devDependencies['@eslint/eslintrc'] = versions_1.eslintrcVersion;
    }
    if (addESLintJS) {
        devDependencies['@eslint/js'] = versions_1.eslintVersion;
    }
    (0, devkit_1.addDependenciesToPackageJson)(tree, {}, devDependencies);
}
