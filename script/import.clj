(ns import
  (:require
    [clojure.string :as str]
    [babashka.http-client :as http]
    [clojure.java.io :as io]
    [clojure.data.csv :as csv]
    [cheshire.core :as json]))


(def d1-api-key (System/getenv "D1_API_KEY"))
(def d1-account (System/getenv "D1_ACCOUNT"))
(def d1-database-id (System/getenv "D1_DATABASE_ID"))


(def d1-url 
  (str "https://api.cloudflare.com/client/v4/accounts/" d1-account  "/d1/database/" d1-database-id  "/query"))

(defn csv-data->maps
  [csv-data]
  (map zipmap
    (->> (first csv-data)
         (map keyword)
         repeat)
   (rest csv-data)))


(defn calculate-year
  [issue-number]
    (+ (quot issue-number 6)  1993))

(defn calcuate-month-range
  [issue-number]
  (let [month-int (mod issue-number 6)]
    (case month-int
      0 {:start "January" :end "February"}
      1 {:start "March" :end "April"}
      2 {:start "May" :end "June"}
      3 {:start "July" :end "August"}
      4 {:start "September" :end "October"}
      5 {:start "November" :end "December"}
      :not-found)))


(defn send-d1-query
  [url api-key request]
  (http/post url
             {:headers 
              {:content-type "application/json" :authorization (str "Bearer " api-key)}
              :body (json/encode request)}))

(defn insert-recipe
  [front-cover back-cover page category-id issue-id]
  (let[sql "INSERT INTO recipe (titleFrontCover, titleBackCover, page, categoryId, issueId) VALUES (?,?,?,?,?)"
       params [front-cover back-cover page category-id issue-id]
       req {:sql sql :params params}]
    (send-d1-query d1-url d1-api-key req)))

(defn insert-recipes
  [records categories issue-id]
  (let [article-title-keyword (keyword "Article Title (inside front cover)")
        recipe-title-keyword (keyword "Recipe (inside back cover)")]
    (map #(insert-recipe (article-title-keyword %) (recipe-title-keyword % ) (:Page %) ((keyword(str/lower-case (:Category %))) categories)  issue-id  ) records)))


(defn get-issues
  []
  (let [req {:sql "SELECT id, number, startMonth, endMonth, year FROM issue" :parameters []}]
    (->>
      (:results (first(:result (json/parse-string (:body (send-d1-query d1-url d1-api-key req))true))))
      (reduce (fn [acc i] (assoc acc (keyword(str(:number i))) i) ) {}))))
     
(defn get-categories
  []
  (let [req {:sql "SELECT id, name FROM category" :parameters []}]
    (->> 
      (:results (first(:result (json/parse-string (:body (send-d1-query d1-url d1-api-key req))true))))
      (reduce (fn [acc i] (assoc acc (keyword(str/lower-case(:name i))) i) ) {}))))

(defn csv-data
  [csv-file-path]
  (csv/read-csv (io/reader csv-file-path)))

(defn insert-new-category
  [category-name]
  (let [sql "INSERT INTO category (name) VALUES (?) RETURNING id"
        req {:params [category-name] :sql sql}]
       (:id(first(:results (first(:result (json/parse-string (:body (send-d1-query d1-url d1-api-key req))true))))))

    ))

(defn insert-new-issue
  [issue-number]
  (let [issue-int (Integer/parseInt issue-number)
        year (calculate-year issue-int)
        month (calcuate-month-range issue-int)
        sql "INSERT INTO issue (number, startMonth, endMonth, year) VALUES (?,?,?,?) RETURNING id"
        req {:params [issue-int (:start month) (:end month) year] :sql sql}]
       (:id(first(:results (first(:result (json/parse-string (:body (send-d1-query d1-url d1-api-key req))true))))))
    ))

(defn get-category-id-map
  "Get mapping of categories already in database or create new ones"
  [cur-categories categories]
  (reduce (fn [acc i]
            (let [category-name (keyword(str/lower-case i))]
              (if (contains? cur-categories category-name)
                (assoc acc category-name (:id(get cur-categories category-name) ))
                (assoc acc category-name (insert-new-category i)))))
           {}
          categories))

(defn get-issue
  "Get issue from database or create new one"
  [issue-number]
  (let [issues (get-issues)
        has-issue (get issues (keyword issue-number))]

    (if (nil? has-issue) (insert-new-issue issue-number)
      (:id (keyword issue-number) issues))))


(defn -main
  [& [issue path]]
  (let [data (csv-data->maps (csv-data path))
        categories (set(map :Category data))
        cur-categories (get-categories)
        mapped-categories (get-category-id-map cur-categories categories)
        issue-id (:id((keyword issue)(get-issue issue)))]
    (println (insert-recipes data mapped-categories issue-id ))))
